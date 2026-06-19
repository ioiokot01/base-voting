// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Deployed Voting on Base Sepolia (chainId 84532).
// https://sepolia.basescan.org/address/0x5698DC8bb02Da3A13C2ED6A26C2CcB310FE39bCE
const CONTRACT_ADDRESS = "0x5698DC8bb02Da3A13C2ED6A26C2CcB310FE39bCE";

const ABI = [
  "function createProposal(string title, string[] options) external returns (uint256)",
  "function vote(uint256 id, uint256 optionIndex) external",
  "function proposalCount() view returns (uint256)",
  "function getProposal(uint256 id) view returns (string title, address creator, uint256 createdAt, string[] options, uint256[] counts)",
  "function totalVotes(uint256 id) view returns (uint256)",
  "function hasVoted(uint256 id, address) view returns (bool)",
  "function choiceOf(uint256 id, address voter) view returns (uint256)",
  "event ProposalCreated(uint256 indexed id, address indexed creator, string title)",
  "event Voted(uint256 indexed id, address indexed voter, uint256 indexed optionIndex)",
];

const MAX_OPTIONS = 10;

// ---------------------------------------------------------------------------
// State + refs
// ---------------------------------------------------------------------------

let provider, signer, contract, account;

const els = {
  connectBtn: document.getElementById("connectBtn"),
  account: document.getElementById("account"),
  createCard: document.getElementById("createCard"),
  titleInput: document.getElementById("titleInput"),
  optionInputs: document.getElementById("optionInputs"),
  addOptionBtn: document.getElementById("addOptionBtn"),
  createBtn: document.getElementById("createBtn"),
  status: document.getElementById("status"),
  count: document.getElementById("count"),
  refreshBtn: document.getElementById("refreshBtn"),
  proposals: document.getElementById("proposals"),
  empty: document.getElementById("empty"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " " + kind : "");
}

function short(a) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function formatTime(unixSeconds) {
  return new Date(Number(unixSeconds) * 1000).toLocaleString();
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

async function connect() {
  if (!window.ethereum) {
    setStatus("No wallet found. Install MetaMask or Coinbase Wallet.", "error");
    return;
  }
  if (!CONTRACT_ADDRESS) {
    setStatus("Set CONTRACT_ADDRESS in app.js after deploying.", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = (await signer.getAddress()).toLowerCase();

    els.account.textContent = "Connected: " + short(account);
    els.account.classList.remove("hidden");
    els.connectBtn.textContent = "Connected";

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    els.createCard.classList.remove("hidden");
    els.refreshBtn.disabled = false;

    await refresh();
    contract.on("ProposalCreated", () => refresh());
    contract.on("Voted", () => refresh());
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to connect.", "error");
  }
}

// ---------------------------------------------------------------------------
// Read + render
// ---------------------------------------------------------------------------

async function refresh() {
  if (!contract) return;
  setStatus("Loading…");
  try {
    const count = Number(await contract.proposalCount());
    els.count.textContent = count ? `(${count})` : "";

    if (count === 0) {
      els.proposals.innerHTML = "";
      els.empty.classList.remove("hidden");
      setStatus("");
      return;
    }
    els.empty.classList.add("hidden");

    // Load all proposals (newest first) along with the caller's vote status.
    const ids = [...Array(count).keys()].reverse();
    const data = await Promise.all(
      ids.map(async (id) => {
        const p = await contract.getProposal(id);
        const voted = await contract.hasVoted(id, account);
        let choice = -1;
        if (voted) choice = Number(await contract.choiceOf(id, account));
        return { id, p, voted, choice };
      })
    );

    els.proposals.innerHTML = "";
    data.forEach(renderProposal);
    setStatus("");
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to load.", "error");
  }
}

function renderProposal({ id, p, voted, choice }) {
  const counts = p.counts.map((c) => Number(c));
  const total = counts.reduce((a, b) => a + b, 0);

  const card = document.createElement("div");
  card.className = "proposal";

  const title = document.createElement("p");
  title.className = "proposal-title";
  title.textContent = p.title;

  const meta = document.createElement("p");
  meta.className = "proposal-meta";
  meta.textContent = `#${id} · by ${short(p.creator)} · ${formatTime(
    p.createdAt
  )}`;

  card.append(title, meta);

  p.options.forEach((label, i) => {
    const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;

    const opt = document.createElement("div");
    opt.className = "option" + (voted && choice === i ? " chosen" : "");

    const row = document.createElement("div");
    row.className = "option-row";

    const lbl = document.createElement("span");
    lbl.className = "option-label";
    lbl.textContent = label + (voted && choice === i ? " ✓" : "");

    const pctEl = document.createElement("span");
    pctEl.className = "option-pct";
    pctEl.textContent = `${counts[i]} · ${pct}%`;

    row.append(lbl, pctEl);

    if (!voted) {
      const btn = document.createElement("button");
      btn.className = "vote-btn";
      btn.textContent = "Vote";
      btn.addEventListener("click", () => castVote(id, i));
      row.appendChild(btn);
    }

    const bar = document.createElement("div");
    bar.className = "bar";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = pct + "%";
    bar.appendChild(fill);

    opt.append(row, bar);
    card.appendChild(opt);
  });

  const foot = document.createElement("div");
  foot.className = "proposal-foot";
  const totalEl = document.createElement("span");
  totalEl.textContent = `${total} vote${total === 1 ? "" : "s"}`;
  const statusEl = document.createElement("span");
  statusEl.textContent = voted ? "You voted" : "Not voted yet";
  foot.append(totalEl, statusEl);
  card.appendChild(foot);

  els.proposals.appendChild(card);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function createProposal() {
  const title = els.titleInput.value.trim();
  const options = [...els.optionInputs.querySelectorAll(".opt")]
    .map((i) => i.value.trim())
    .filter((v) => v.length > 0);

  if (!title) {
    setStatus("Enter a title.", "error");
    return;
  }
  if (options.length < 2) {
    setStatus("Add at least 2 options.", "error");
    return;
  }

  els.createBtn.disabled = true;
  try {
    setStatus("Confirm in your wallet…");
    const tx = await contract.createProposal(title, options);
    setStatus("Creating proposal…");
    await tx.wait();
    setStatus("Proposal created! 🎉", "ok");
    resetCreateForm();
    await refresh();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Create failed.", "error");
  } finally {
    els.createBtn.disabled = false;
  }
}

async function castVote(id, optionIndex) {
  try {
    setStatus("Confirm your vote in your wallet…");
    const tx = await contract.vote(id, optionIndex);
    setStatus("Submitting vote…");
    await tx.wait();
    setStatus("Voted! ✅", "ok");
    await refresh();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Vote failed.", "error");
  }
}

// ---------------------------------------------------------------------------
// Create-form UI
// ---------------------------------------------------------------------------

function addOptionInput() {
  const current = els.optionInputs.querySelectorAll(".opt").length;
  if (current >= MAX_OPTIONS) {
    setStatus(`Max ${MAX_OPTIONS} options.`, "error");
    return;
  }
  const input = document.createElement("input");
  input.className = "opt";
  input.type = "text";
  input.maxLength = 100;
  input.placeholder = "Option " + (current + 1);
  els.optionInputs.appendChild(input);
}

function resetCreateForm() {
  els.titleInput.value = "";
  els.optionInputs.innerHTML = "";
  for (let i = 0; i < 2; i++) addOptionInput();
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

els.connectBtn.addEventListener("click", connect);
els.createBtn.addEventListener("click", createProposal);
els.refreshBtn.addEventListener("click", refresh);
els.addOptionBtn.addEventListener("click", addOptionInput);

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}
