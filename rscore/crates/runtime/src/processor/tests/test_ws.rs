use std::fs;
use std::io::{BufRead as _, BufReader};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

use serde_json::Value;

pub(super) struct CanonicalWsServer {
    child: Child,
    directory: std::path::PathBuf,
    received: std::path::PathBuf,
    pub runtime_id: String,
    pub port: u64,
}

impl CanonicalWsServer {
    pub fn start(label: &str) -> Self {
        Self::start_with_saturation(label, "", "")
    }

    pub fn start_saturating(label: &str, entity: &str, signer: &str) -> Self {
        Self::start_with_saturation(label, entity, signer)
    }

    fn start_with_saturation(label: &str, entity: &str, signer: &str) -> Self {
        let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../../..")
            .canonicalize()
            .expect("repository root");
        let directory = std::env::temp_dir().join(format!(
            "xln-rscore-processor-ws-{label}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&directory);
        fs::create_dir_all(&directory).expect("server fixture directory");
        let received = directory.join("received.log");
        let script = r#"
import { appendFileSync } from 'node:fs';
import { deriveSignerAddressSync } from './core/account/crypto.ts';
import { createDirectRuntimeWsRoute } from './core/network/p2p/direct-runtime-bun.ts';
import { requireDeliveryDelivered } from './core/protocol/payments/delivery-result.ts';
const seed='rrs-processor-server';
const runtimeId=deriveSignerAddressSync(seed,'1').toLowerCase();
let saturated = false;
const route=createDirectRuntimeWsRoute({runtimeId,runtimeSeed:seed,path:'/ws',onEntityInputs(from,envelope){
  appendFileSync(process.env.RRS_RECEIVED_PATH,JSON.stringify({height:envelope.sourceRuntimeHeight,count:envelope.entityInputs.length})+'\n');
  if (!process.env.RRS_TARGET_ENTITY || saturated) return;
  const isPayment = envelope.entityInputs.some(input => input.entityTxs.some(tx =>
    tx.type === 'accountInput' && tx.data.proposal?.frame.accountTxs.some(tx => tx.type === 'direct_payment')));
  if (!isPayment) throw new Error('SATURATION_EXPECTED_REAL_PAYMENT');
  saturated = true;
  for (let height = 1; height <= 2; height++) {
    requireDeliveryDelivered(route.sendEntityInputsDelivery(from, {
      sourceRuntimeId: runtimeId, sourceRuntimeHeight: height,
      sourceRuntimeTimestamp: envelope.sourceRuntimeTimestamp,
      entityInputs: [{ runtimeId: from, entityId: process.env.RRS_TARGET_ENTITY,
        signerId: process.env.RRS_TARGET_SIGNER, entityTxs: [] }],
    }, envelope.sourceRuntimeTimestamp), 'SATURATION_SEND_FAILED');
  }
}});
route.setReady(true);
const server=Bun.serve({hostname:'127.0.0.1',port:0,fetch(request,ref){if(ref.upgrade(request))return;return new Response('websocket only',{status:400});},websocket:route.websocket});
console.log(JSON.stringify({port:server.port,runtimeId}));
process.on('SIGTERM',()=>{server.stop(true);process.exit(0)});
"#;
        let mut child = Command::new("bun")
            .args(["-e", script])
            .current_dir(root)
            .env("RRS_RECEIVED_PATH", &received)
            .env("RRS_TARGET_ENTITY", entity)
            .env("RRS_TARGET_SIGNER", signer)
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .expect("canonical websocket server");
        let mut line = String::new();
        BufReader::new(child.stdout.as_mut().expect("server stdout"))
            .read_line(&mut line)
            .expect("server startup");
        let startup: Value = serde_json::from_str(&line).expect("server startup json");
        Self {
            child,
            directory,
            received,
            runtime_id: startup["runtimeId"]
                .as_str()
                .expect("server runtime id")
                .to_string(),
            port: startup["port"].as_u64().expect("server port"),
        }
    }

    pub fn wait_for_rows(&self, count: usize) {
        let deadline = Instant::now() + Duration::from_secs(3);
        while Instant::now() < deadline {
            if self.rows().is_some_and(|received| received.len() >= count) {
                return;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        panic!("websocket delivery timeout");
    }

    pub fn rows(&self) -> Option<Vec<Value>> {
        fs::read_to_string(&self.received).ok().map(|contents| {
            contents
                .lines()
                .map(|line| serde_json::from_str(line).expect("received envelope row"))
                .collect()
        })
    }
}

impl Drop for CanonicalWsServer {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        let _ = fs::remove_dir_all(&self.directory);
    }
}
