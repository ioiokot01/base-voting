# Onchain Voting

[![CI](https://github.com/ioiokot01/base-voting/actions/workflows/ci.yml/badge.svg)](https://github.com/ioiokot01/base-voting/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)
![Chain](https://img.shields.io/badge/Base-Sepolia-0052ff.svg)

An **on-chain voting booth** for the [Base](https://base.org) ecosystem. Anyone
can create a proposal with 2–10 options, and any wallet can cast exactly one
vote per proposal. Tallies live on-chain and are public.

Project 6 in a learning series. New concepts: **nested storage** (per-proposal
options and counts), **one-vote-per-wallet** guarding, and returning **dynamic
arrays** from view functions.

## Stack

- [Hardhat 2](https://hardhat.org) — compile, test, deploy
- Solidity `0.8.24`
- Target chain: Base Sepolia (testnet)

## Getting started

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Contract

`contracts/Voting.sol`

| Function | Description |
| --- | --- |
| `createProposal(string title, string[] options)` | Create a 2–10 option proposal |
| `vote(uint256 id, uint256 optionIndex)` | Cast one vote on a proposal |
| `getProposal(uint256 id)` | Title, creator, time, options + live counts |
| `proposalCount()` | Number of proposals |
| `totalVotes(uint256 id)` | Total votes cast on a proposal |
| `hasVoted(uint256 id, address)` | Whether a wallet has voted |
| `choiceOf(uint256 id, address)` | Which option a wallet chose |

Emits `ProposalCreated` and `Voted`.

## Deploy

```bash
cp .env.example .env   # then fill in PRIVATE_KEY (testnet wallet only)
npm run deploy
```

## Roadmap

- [x] Voting contract + tests
- [x] Deploy to Base Sepolia
- [x] Frontend (create proposal, vote, live results)

## Deployments

| Network | Address |
| --- | --- |
| Base Sepolia | [`0x5698DC8bb02Da3A13C2ED6A26C2CcB310FE39bCE`](https://sepolia.basescan.org/address/0x5698DC8bb02Da3A13C2ED6A26C2CcB310FE39bCE) |

## Security notes

- No funds are handled — the contract only records votes.
- One vote per wallet per proposal is enforced on-chain (`hasVoted`).
- Secrets (`.env`, private keys) are git-ignored and never committed.
- All development targets a **testnet** — no real funds.

## License

MIT
