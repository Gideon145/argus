// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title ArgusOracle
 * @notice Immutable verdict log on Arc testnet.
 *         Records agent verdicts, consensus outcomes, and ELO reputation.
 *         Verdicts cannot be modified once written.
 */
contract ArgusOracle {
    struct Verdict {
        string agentId;
        string verdict; // "SAFE", "RISKY", "SCAM"
        uint256 confidence; // 0-100
        uint64 timestamp;
    }

    struct Query {
        address indexed contractAddress;
        string chain;
        address indexed user;
        Verdict[3] verdicts; // Exactly 3 agents
        string finalVerdict; // Consensus result
        bool consensusReached;
        uint64 timestamp;
        uint256 queryId;
    }

    struct AgentReputation {
        string agentId;
        int256 eloScore; // Starting ELO: 1500
        uint256 totalQueries;
        uint256 correctVerdicts;
    }

    uint256 public queryCount;
    mapping(uint256 => Query) public queries;
    mapping(string => AgentReputation) public agents;

    event QueryRecorded(uint256 indexed queryId, address indexed user, string finalVerdict, bool consensus);
    event ReputationUpdated(string indexed agentId, int256 eloDelta, int256 newElo);

    /**
     * @dev Record a completed query with all 3 verdicts.
     *      Verdicts are immutable once stored.
     */
    function recordQuery(
        address contractAddress,
        string calldata chain,
        address user,
        string[3] calldata agentIds,
        string[3] calldata verdicts,
        uint256[3] calldata confidences,
        string calldata finalVerdict,
        bool consensusReached
    ) external returns (uint256 queryId) {
        queryId = ++queryCount;

        Verdict[3] memory vs;
        for (uint i = 0; i < 3; i++) {
            vs[i] = Verdict({
                agentId: agentIds[i],
                verdict: verdicts[i],
                confidence: confidences[i],
                timestamp: uint64(block.timestamp)
            });
        }

        queries[queryId] = Query({
            contractAddress: contractAddress,
            chain: chain,
            user: user,
            verdicts: vs,
            finalVerdict: finalVerdict,
            consensusReached: consensusReached,
            timestamp: uint64(block.timestamp),
            queryId: queryId
        });

        emit QueryRecorded(queryId, user, finalVerdict, consensusReached);
    }

    /**
     * @dev Update agent ELO reputation (called by orchestrator)
     * @param agentId Agent identifier
     * @param eloDelta Change in ELO score
     */
    function updateElo(string calldata agentId, int256 eloDelta) external {
        AgentReputation storage agent = agents[agentId];
        if (agent.eloScore == 0) {
            agent.eloScore = 1500; // Starting ELO
        }
        agent.agentId = agentId;
        agent.eloScore += eloDelta;
        agent.totalQueries++;
        if (eloDelta > 0) {
            agent.correctVerdicts++;
        }

        emit ReputationUpdated(agentId, eloDelta, agent.eloScore);
    }

    /**
     * @dev Get agent ELO score
     */
    function getElo(string calldata agentId) external view returns (int256) {
        AgentReputation storage agent = agents[agentId];
        return agent.eloScore > 0 ? agent.eloScore : 1500;
    }
}
