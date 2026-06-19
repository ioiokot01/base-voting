const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Voting", function () {
  async function deploy() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Voting");
    const voting = await Factory.deploy();
    await voting.waitForDeployment();
    return { voting, owner, alice, bob, carol };
  }

  async function withProposal() {
    const ctx = await deploy();
    await ctx.voting
      .connect(ctx.alice)
      .createProposal("Best chain?", ["Base", "Optimism", "Arbitrum"]);
    return ctx;
  }

  describe("Creating proposals", function () {
    it("creates a proposal and emits ProposalCreated", async function () {
      const { voting, alice } = await deploy();
      await expect(
        voting.connect(alice).createProposal("Lunch?", ["Pizza", "Sushi"])
      )
        .to.emit(voting, "ProposalCreated")
        .withArgs(0, alice.address, "Lunch?");

      expect(await voting.proposalCount()).to.equal(1n);
      const p = await voting.getProposal(0);
      expect(p.title).to.equal("Lunch?");
      expect(p.creator).to.equal(alice.address);
      expect(p.options).to.deep.equal(["Pizza", "Sushi"]);
      expect(p.counts).to.deep.equal([0n, 0n]);
      expect(p.createdAt).to.be.greaterThan(0n);
    });

    it("assigns sequential ids", async function () {
      const { voting, alice } = await deploy();
      await voting.connect(alice).createProposal("A", ["x", "y"]);
      await voting.connect(alice).createProposal("B", ["x", "y"]);
      expect(await voting.proposalCount()).to.equal(2n);
      expect((await voting.getProposal(1)).title).to.equal("B");
    });

    it("rejects an empty title", async function () {
      const { voting } = await deploy();
      await expect(
        voting.createProposal("", ["a", "b"])
      ).to.be.revertedWith("Title required");
    });

    it("rejects too few options", async function () {
      const { voting } = await deploy();
      await expect(
        voting.createProposal("Only one", ["a"])
      ).to.be.revertedWith("Bad option count");
    });

    it("rejects too many options", async function () {
      const { voting } = await deploy();
      const eleven = Array.from({ length: 11 }, (_, i) => "opt" + i);
      await expect(
        voting.createProposal("Too many", eleven)
      ).to.be.revertedWith("Bad option count");
    });

    it("rejects an empty option label", async function () {
      const { voting } = await deploy();
      await expect(
        voting.createProposal("Has blank", ["ok", ""])
      ).to.be.revertedWith("Empty option");
    });
  });

  describe("Voting", function () {
    it("records a vote and tallies it", async function () {
      const { voting, bob } = await withProposal();
      await expect(voting.connect(bob).vote(0, 0))
        .to.emit(voting, "Voted")
        .withArgs(0, bob.address, 0);

      const p = await voting.getProposal(0);
      expect(p.counts).to.deep.equal([1n, 0n, 0n]);
      expect(await voting.hasVoted(0, bob.address)).to.equal(true);
      expect(await voting.choiceOf(0, bob.address)).to.equal(0n);
      expect(await voting.totalVotes(0)).to.equal(1n);
    });

    it("tallies votes from multiple wallets", async function () {
      const { voting, alice, bob, carol } = await withProposal();
      await voting.connect(alice).vote(0, 0); // Base
      await voting.connect(bob).vote(0, 0); // Base
      await voting.connect(carol).vote(0, 2); // Arbitrum

      const p = await voting.getProposal(0);
      expect(p.counts).to.deep.equal([2n, 0n, 1n]);
      expect(await voting.totalVotes(0)).to.equal(3n);
    });

    it("blocks a wallet from voting twice", async function () {
      const { voting, bob } = await withProposal();
      await voting.connect(bob).vote(0, 1);
      await expect(voting.connect(bob).vote(0, 0)).to.be.revertedWith(
        "Already voted"
      );
    });

    it("rejects voting on a missing proposal", async function () {
      const { voting, bob } = await deploy();
      await expect(voting.connect(bob).vote(0, 0)).to.be.revertedWith(
        "No such proposal"
      );
    });

    it("rejects an out-of-range option", async function () {
      const { voting, bob } = await withProposal();
      await expect(voting.connect(bob).vote(0, 5)).to.be.revertedWith(
        "Bad option"
      );
    });

    it("keeps votes isolated per proposal", async function () {
      const { voting, alice, bob } = await withProposal();
      await voting.connect(alice).createProposal("Second", ["yes", "no"]);

      await voting.connect(bob).vote(0, 0);
      // Same wallet can still vote on a different proposal.
      await voting.connect(bob).vote(1, 1);

      expect(await voting.totalVotes(0)).to.equal(1n);
      expect(await voting.totalVotes(1)).to.equal(1n);
      expect((await voting.getProposal(1)).counts).to.deep.equal([0n, 1n]);
    });
  });

  describe("Views", function () {
    it("reverts choiceOf for a wallet that hasn't voted", async function () {
      const { voting, bob } = await withProposal();
      await expect(voting.choiceOf(0, bob.address)).to.be.revertedWith(
        "Not voted"
      );
    });

    it("reverts getProposal for a missing id", async function () {
      const { voting } = await deploy();
      await expect(voting.getProposal(0)).to.be.revertedWith(
        "No such proposal"
      );
    });
  });
});
