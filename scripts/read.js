const hre = require("hardhat");

// Deployed Voting on Base Sepolia.
const ADDRESS = "0x5698DC8bb02Da3A13C2ED6A26C2CcB310FE39bCE";

async function main() {
  const voting = await hre.ethers.getContractAt("Voting", ADDRESS);

  const count = Number(await voting.proposalCount());
  console.log("Voting:", ADDRESS);
  console.log("Proposals:", count);

  for (let id = 0; id < count; id++) {
    const p = await voting.getProposal(id);
    console.log(`\n#${id} "${p.title}" by ${p.creator}`);
    p.options.forEach((opt, i) => {
      console.log(`   [${i}] ${opt} — ${p.counts[i]} vote(s)`);
    });
    console.log("   total:", (await voting.totalVotes(id)).toString());
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
