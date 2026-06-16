import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying ArgusOracle with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ARC");

  const ArgusOracle = await ethers.getContractFactory("ArgusOracle");
  const oracle = await ArgusOracle.deploy();
  await oracle.waitForDeployment();

  const address = await oracle.getAddress();
  console.log("\n✅ ArgusOracle deployed to:", address);
  console.log("ArcScan:", `https://testnet.arcscan.app/address/${address}`);
  
  // Verify the contract is live
  const queryCount = await oracle.queryCount();
  console.log("Initial queryCount:", queryCount.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
