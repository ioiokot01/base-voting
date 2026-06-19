// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title Voting
/// @notice On-chain voting booth. Anyone can create a proposal with 2–10 options,
///         and any wallet can cast exactly one vote per proposal. Tallies are kept
///         on-chain and are public.
/// @dev    Demonstrates nested storage (per-proposal options/counts), one-vote-per
///         -wallet guarding, and returning dynamic arrays from views. No funds.
contract Voting {
    uint256 public constant MIN_OPTIONS = 2;
    uint256 public constant MAX_OPTIONS = 10;
    uint256 public constant MAX_TITLE_LENGTH = 200;
    uint256 public constant MAX_OPTION_LENGTH = 100;

    struct Proposal {
        string title;
        address creator;
        uint256 createdAt;
    }

    Proposal[] private _proposals;
    mapping(uint256 => string[]) private _options; // proposalId => option labels
    mapping(uint256 => uint256[]) private _counts; // proposalId => votes per option
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // 1-indexed choice (0 = not voted) so it doubles as a "voted" flag.
    mapping(uint256 => mapping(address => uint256)) private _choice;

    event ProposalCreated(
        uint256 indexed id,
        address indexed creator,
        string title
    );
    event Voted(
        uint256 indexed id,
        address indexed voter,
        uint256 indexed optionIndex
    );

    /// @notice Create a proposal with a set of options. Returns the new id.
    function createProposal(string calldata title, string[] calldata options)
        external
        returns (uint256 id)
    {
        require(bytes(title).length > 0, "Title required");
        require(bytes(title).length <= MAX_TITLE_LENGTH, "Title too long");
        require(
            options.length >= MIN_OPTIONS && options.length <= MAX_OPTIONS,
            "Bad option count"
        );

        id = _proposals.length;
        _proposals.push(
            Proposal({title: title, creator: msg.sender, createdAt: block.timestamp})
        );

        for (uint256 i = 0; i < options.length; i++) {
            require(bytes(options[i]).length > 0, "Empty option");
            require(
                bytes(options[i]).length <= MAX_OPTION_LENGTH,
                "Option too long"
            );
            _options[id].push(options[i]);
            _counts[id].push(0);
        }

        emit ProposalCreated(id, msg.sender, title);
    }

    /// @notice Cast one vote for `optionIndex` on proposal `id`.
    function vote(uint256 id, uint256 optionIndex) external {
        require(id < _proposals.length, "No such proposal");
        require(optionIndex < _options[id].length, "Bad option");
        require(!hasVoted[id][msg.sender], "Already voted");

        hasVoted[id][msg.sender] = true;
        _choice[id][msg.sender] = optionIndex + 1; // store 1-indexed
        _counts[id][optionIndex] += 1;

        emit Voted(id, msg.sender, optionIndex);
    }

    /// @notice Total number of proposals created.
    function proposalCount() external view returns (uint256) {
        return _proposals.length;
    }

    /// @notice Full details for a proposal, including options and live tallies.
    function getProposal(uint256 id)
        external
        view
        returns (
            string memory title,
            address creator,
            uint256 createdAt,
            string[] memory options,
            uint256[] memory counts
        )
    {
        require(id < _proposals.length, "No such proposal");
        Proposal storage p = _proposals[id];
        return (p.title, p.creator, p.createdAt, _options[id], _counts[id]);
    }

    /// @notice The option index `voter` chose (reverts if they haven't voted).
    function choiceOf(uint256 id, address voter)
        external
        view
        returns (uint256)
    {
        require(hasVoted[id][voter], "Not voted");
        return _choice[id][voter] - 1;
    }

    /// @notice The total number of votes cast on a proposal.
    function totalVotes(uint256 id) external view returns (uint256 sum) {
        require(id < _proposals.length, "No such proposal");
        uint256[] storage c = _counts[id];
        for (uint256 i = 0; i < c.length; i++) {
            sum += c[i];
        }
    }
}
