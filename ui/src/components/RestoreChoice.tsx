type Props = { enabled: boolean; address: string; onToggle: (enabled: boolean) => void; onAddress: (address: string) => void };

export function RestoreChoice({ enabled, address, onToggle, onAddress }: Props) {
	return (
		<div className="field">
			<label className="field-row">
				<input type="checkbox" checked={enabled} onChange={event => onToggle(event.target.checked)} data-testid="restore-from-tower" />
				<span>Restore a backup on this device</span>
			</label>
			{enabled && <>
				<label className="field">
					<span className="field-label">Your backup tower</span>
					<input className="input" type="url" value={address} onChange={event => onAddress(event.target.value)} placeholder="https://your-tower.example" required data-testid="restore-tower-url" />
				</label>
				<p className="note">Your phrase decrypts the backup here. Restoration checks its signatures and requires a device with no local data for this wallet.</p>
			</>}
		</div>
	);
}
