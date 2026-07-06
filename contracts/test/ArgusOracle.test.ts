import { expect } from "chai";
import { ethers } from "hardhat";
import { ArgusOracle } from "../typechain-types";

describe("ArgusOracle", function () {
  let oracle: ArgusOracle;
  let deployer: any;

  beforeEach(async function () {
    [deployer] = await ethers.getSigners();
    const Oracle = await ethers.getContractFactory("ArgusOracle");
    oracle = await Oracle.deploy();
    await oracle.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should start with queryCount 0", async function () {
      expect(await oracle.queryCount()).to.equal(0);
    });

    it("should return default ELO of 1500 for unknown agent", async function () {
      expect(await oracle.getElo("alpha")).to.equal(1500);
    });
  });

  describe("recordQuery", function () {
    it("should record a query and emit QueryRecorded event", async function () {
      const addr = "0x" + "1".repeat(40);
      const tx = await oracle.recordQuery(
        addr,
        "arc-testnet",
        deployer.address,
        ["alpha", "beta", "gamma"],
        ["SAFE", "SAFE", "RISKY"],
        [90, 85, 60],
        "SAFE",
        true
      );

      await expect(tx)
        .to.emit(oracle, "QueryRecorded")
        .withArgs(1, deployer.address, "SAFE", true);

      expect(await oracle.queryCount()).to.equal(1);

      const q = await oracle.queries(1);
      expect(q.contractAddress).to.equal(addr);
      expect(q.finalVerdict).to.equal("SAFE");
      expect(q.consensusReached).to.equal(true);
      expect(q.user).to.equal(deployer.address);
      expect(q.queryId).to.equal(1);
    });

    it("should record a query with no consensus", async function () {
      const addr = "0x" + "2".repeat(40);
      await oracle.recordQuery(
        addr,
        "arc-testnet",
        deployer.address,
        ["alpha", "beta", "gamma"],
        ["SAFE", "RISKY", "SCAM"],
        [50, 50, 50],
        "RISKY",
        false
      );

      const q = await oracle.queries(1);
      expect(q.consensusReached).to.equal(false);
      expect(q.finalVerdict).to.equal("RISKY");
    });

    it("should increment queryCount across multiple queries", async function () {
      const addr1 = "0x" + "3".repeat(40);
      const addr2 = "0x" + "4".repeat(40);

      await oracle.recordQuery(
        addr1, "arc-testnet", deployer.address,
        ["alpha", "beta", "gamma"],
        ["SAFE", "SAFE", "SAFE"],
        [90, 90, 90],
        "SAFE", true
      );

      await oracle.recordQuery(
        addr2, "arc-testnet", deployer.address,
        ["alpha", "beta", "gamma"],
        ["SCAM", "SCAM", "SCAM"],
        [95, 95, 95],
        "SCAM", true
      );

      expect(await oracle.queryCount()).to.equal(2);
      expect((await oracle.queries(1)).queryId).to.equal(1);
      expect((await oracle.queries(2)).queryId).to.equal(2);
    });

    it("should store SCAM verdict correctly", async function () {
      const addr = "0x" + "7".repeat(40);
      await oracle.recordQuery(
        addr, "arc-testnet", deployer.address,
        ["alpha", "beta", "gamma"],
        ["SCAM", "SCAM", "SCAM"],
        [95, 95, 95],
        "SCAM", true
      );

      const q = await oracle.queries(1);
      expect(q.finalVerdict).to.equal("SCAM");
      expect(q.consensusReached).to.equal(true);
    });
  });

  describe("updateElo", function () {
    it("should initialize agent at 1500 ELO on first update", async function () {
      await oracle.updateElo("alpha", 10);
      expect(await oracle.getElo("alpha")).to.equal(1510);
    });

    it("should apply negative ELO delta correctly", async function () {
      await oracle.updateElo("alpha", 10);
      await oracle.updateElo("alpha", -5);
      expect(await oracle.getElo("alpha")).to.equal(1505);
    });

    it("should track totalQueries and correctVerdicts", async function () {
      await oracle.updateElo("alpha", 10);
      await oracle.updateElo("alpha", -5);
      await oracle.updateElo("alpha", 20);

      const agent = await oracle.agents("alpha");
      expect(agent.totalQueries).to.equal(3);
      expect(agent.correctVerdicts).to.equal(2);
    });

    it("should emit ReputationUpdated event", async function () {
      await expect(oracle.updateElo("alpha", 10))
        .to.emit(oracle, "ReputationUpdated")
        .withArgs("alpha", 10, 1510);
    });

    it("should handle multiple agents independently", async function () {
      await oracle.updateElo("alpha", 10);
      await oracle.updateElo("beta", -5);
      await oracle.updateElo("gamma", 20);

      expect(await oracle.getElo("alpha")).to.equal(1510);
      expect(await oracle.getElo("beta")).to.equal(1495);
      expect(await oracle.getElo("gamma")).to.equal(1520);
    });

    it("should handle zero ELO delta", async function () {
      await oracle.updateElo("alpha", 0);
      expect(await oracle.getElo("alpha")).to.equal(1500);
      const agent = await oracle.agents("alpha");
      expect(agent.totalQueries).to.equal(1);
      expect(agent.correctVerdicts).to.equal(0);
    });

    it("should handle large ELO deltas", async function () {
      await oracle.updateElo("alpha", 500);
      expect(await oracle.getElo("alpha")).to.equal(2000);
      await oracle.updateElo("alpha", -300);
      expect(await oracle.getElo("alpha")).to.equal(1700);
    });
  });

  describe("Access Control", function () {
    it("should allow any caller to record a query", async function () {
      const [_, other] = await ethers.getSigners();
      const addr = "0x" + "5".repeat(40);

      await oracle.connect(other).recordQuery(
        addr,
        "arc-testnet",
        other.address,
        ["alpha", "beta", "gamma"],
        ["RISKY", "RISKY", "RISKY"],
        [70, 70, 70],
        "RISKY",
        true
      );

      expect(await oracle.queryCount()).to.equal(1);
    });

    it("should allow any caller to update ELO", async function () {
      const [_, other] = await ethers.getSigners();
      await oracle.updateElo("alpha", 10);
      await oracle.connect(other).updateElo("alpha", 5);
      expect(await oracle.getElo("alpha")).to.equal(1515);
    });
  });

  describe("getElo", function () {
    it("should return 1500 for uninitialized agent", async function () {
      expect(await oracle.getElo("never_seen")).to.equal(1500);
    });

    it("should return correct ELO after updates", async function () {
      await oracle.updateElo("alpha", 30);
      await oracle.updateElo("alpha", -10);
      expect(await oracle.getElo("alpha")).to.equal(1520);
    });
  });

  describe("Data Immutability", function () {
    it("should persist recorded queries permanently", async function () {
      const addr = "0x" + "6".repeat(40);
      await oracle.recordQuery(
        addr, "arc-testnet", deployer.address,
        ["alpha", "beta", "gamma"],
        ["SAFE", "SAFE", "SAFE"],
        [90, 90, 90],
        "SAFE", true
      );

      // Re-read the same query — data must be unchanged
      const q = await oracle.queries(1);
      expect(q.finalVerdict).to.equal("SAFE");
      expect(q.contractAddress).to.equal(addr);
      expect(q.chain).to.equal("arc-testnet");

      // Query count must not have changed
      expect(await oracle.queryCount()).to.equal(1);
    });

    it("should not overwrite existing queries", async function () {
      await oracle.recordQuery(
        "0x" + "8".repeat(40), "arc-testnet", deployer.address,
        ["alpha", "beta", "gamma"],
        ["SAFE", "SAFE", "SAFE"],
        [90, 90, 90],
        "SAFE", true
      );

      await oracle.recordQuery(
        "0x" + "9".repeat(40), "arc-testnet", deployer.address,
        ["alpha", "beta", "gamma"],
        ["SCAM", "SCAM", "SCAM"],
        [95, 95, 95],
        "SCAM", true
      );

      // Query 1 must still be SAFE, not overwritten by query 2
      expect((await oracle.queries(1)).finalVerdict).to.equal("SAFE");
      expect((await oracle.queries(2)).finalVerdict).to.equal("SCAM");
      expect(await oracle.queryCount()).to.equal(2);
    });
  });
});
