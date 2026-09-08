import { safeStringify } from '../../../core/protocol/serialization';
import { executeCertifiedBoardRotationVector } from './cases';

process.stdout.write(`${safeStringify(executeCertifiedBoardRotationVector(), 2)}\n`);
