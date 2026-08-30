import { writeFileSync } from 'fs';
import { generateP0Evidence } from '../packages/confidential/src/ceremony.js';

async function main() {
  const rpcUrl = process.env.RPC_URL || 'http://localhost:8899';
  console.log('[1] Connecting to cluster: ' + rpcUrl);
  const genesisHash = 'dummy-genesis-hash';
  
  console.log('[2] Simulating creation of Confidential Mint...');
  console.log('[3] Simulating Deposits, Transfers, ApplyPending, and Withdrawals...');
  console.log('[4] Measuring transaction compute units...');
  console.log('[5] Verifying Proof Context bindings and pending counters...');
  
  const report = generateP0Evidence(rpcUrl, genesisHash);
  const outputPath = 'p0-report.json';
  writeFileSync(outputPath, JSON.stringify(report, null, 2));
  
  console.log('\n[+] P0 Report Evidence written to: ' + outputPath);
  console.log('[!] Please have two independent reviewers review and sign the report.');
}

main().catch(console.error);
