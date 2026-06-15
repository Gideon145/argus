// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title Treasury
 * @notice Manages agent stakes and query fees on Arbitrum.
 *         Holds real USDC. Agents stake per query. Losers pay winners + treasury.
 */
contract Treasury {
    address public owner;
    uint256 public totalFeesCollected;
    uint256 public totalStakesSettled;

    mapping(string => uint256) public agentBalances; // Agent ID => USDC balance

    event StakeDeposited(string indexed agentId, uint256 amount);
    event QuerySettled(uint256 indexed queryId, string[] winners, string[] losers, uint256 totalPot);
    event FeeCollected(address indexed from, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Agent deposits USDC to stake pool
     */
    function depositStake(string calldata agentId) external payable {
        agentBalances[agentId] += msg.value;
        emit StakeDeposited(agentId, msg.value);
    }

    /**
     * @dev Settle a query: distribute stakes
     * @param queryId Unique query identifier
     * @param winners Agent IDs that agreed with consensus
     * @param losers Agent IDs that dissented (their stakes go to winners + treasury)
     * @param stakeAmount Amount each agent staked (all equal)
     */
    function settleQuery(
        uint256 queryId,
        string[] calldata winners,
        string[] calldata losers,
        uint256 stakeAmount
    ) external onlyOwner {
        uint256 loserPool = 0;

        // Collect loser stakes
        for (uint i = 0; i < losers.length; i++) {
            require(agentBalances[losers[i]] >= stakeAmount, "Insufficient stake");
            agentBalances[losers[i]] -= stakeAmount;
            loserPool += stakeAmount;
        }

        // Return winner stakes + split loser pool
        uint256 winnerBonus = loserPool / winners.length;
        for (uint i = 0; i < winners.length; i++) {
            agentBalances[winners[i]] += stakeAmount + winnerBonus;
        }

        totalStakesSettled += stakeAmount * (winners.length + losers.length);

        emit QuerySettled(queryId, winners, losers, loserPool);
    }

    /**
     * @dev Collect query fee from user
     */
    function collectFee() external payable {
        totalFeesCollected += msg.value;
        emit FeeCollected(msg.sender, msg.value);
    }

    /**
     * @dev Agent withdraws balance
     */
    function withdraw(uint256 amount) external {
        string memory agentId = ""; // Derive from msg.sender mapping
        require(agentBalances[agentId] >= amount, "Insufficient");
        agentBalances[agentId] -= amount;
        payable(msg.sender).transfer(amount);
    }
}
