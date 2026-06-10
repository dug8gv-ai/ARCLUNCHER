// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
}

/**
 * @title ArcBinaryMarket
 * @notice On-chain 5-minute binary UP/DOWN betting pool on Arc Chain Testnet.
 *
 * Flow:
 *   1. Admin calls openRound(strikePrice) — starts a 5-min round.
 *   2. Users call placeBet(roundId, direction, amount) — locks tokens.
 *   3. After 5 min, Admin calls settleRound(roundId, finalPrice).
 *   4. Winners call claimWinnings(roundId) — receive proportional share of losers' pool.
 *
 * Supported assets: USDC, EURC, crBTC (configured at deploy via supportedTokens).
 * House edge: 2% (configurable by owner).
 */
contract ArcBinaryMarket {

    // ─── Constants ────────────────────────────────────────────────────────────
    uint8  public constant UP   = 1;
    uint8  public constant DOWN = 2;
    uint256 public constant ROUND_DURATION = 5 minutes;
    uint256 public constant HOUSE_FEE_BPS  = 200; // 2%

    // ─── Storage ──────────────────────────────────────────────────────────────
    address public owner;
    address public feeReceiver;

    // Supported settlement tokens
    mapping(address => bool) public supportedTokens;
    address[] public tokenList;

    struct Bet {
        address bettor;
        uint256 amount;
        uint8   direction;   // UP=1 DOWN=2
        bool    claimed;
    }

    struct Round {
        uint256 id;
        address token;          // ERC20 used for this round
        uint256 strikePrice;    // price * 1e8 (8 decimals)
        uint256 finalPrice;     // set on settlement
        uint256 openTime;
        uint256 closeTime;
        uint256 totalUpPool;
        uint256 totalDownPool;
        uint8   winningSide;    // 0=not settled, UP=1, DOWN=2, 3=refund(tie)
        bool    settled;
    }

    uint256 public nextRoundId;
    mapping(uint256 => Round)              public rounds;
    mapping(uint256 => Bet[])              public roundBets;        // roundId → bets
    mapping(uint256 => mapping(address => uint256[])) public userBetIndexes; // roundId→user→bet indexes

    // ─── Events ───────────────────────────────────────────────────────────────
    event RoundOpened(uint256 indexed roundId, address token, uint256 strikePrice, uint256 closeTime);
    event BetPlaced(uint256 indexed roundId, address indexed bettor, uint8 direction, uint256 amount);
    event RoundSettled(uint256 indexed roundId, uint256 finalPrice, uint8 winningSide);
    event WinningsClaimed(uint256 indexed roundId, address indexed bettor, uint256 payout);
    event TokenAdded(address token);
    event TokenRemoved(address token);

    // ─── Modifiers ────────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address[] memory _tokens, address _feeReceiver) {
        owner       = msg.sender;
        feeReceiver = _feeReceiver;
        for (uint i = 0; i < _tokens.length; i++) {
            supportedTokens[_tokens[i]] = true;
            tokenList.push(_tokens[i]);
            emit TokenAdded(_tokens[i]);
        }
    }

    // ─── Admin: token management ──────────────────────────────────────────────
    function addToken(address token) external onlyOwner {
        require(!supportedTokens[token], "Already supported");
        supportedTokens[token] = true;
        tokenList.push(token);
        emit TokenAdded(token);
    }

    function removeToken(address token) external onlyOwner {
        require(supportedTokens[token], "Not supported");
        supportedTokens[token] = false;
        emit TokenRemoved(token);
    }

    function setFeeReceiver(address _fr) external onlyOwner { feeReceiver = _fr; }
    function transferOwnership(address _new) external onlyOwner { owner = _new; }

    // ─── Admin: open round ────────────────────────────────────────────────────
    /**
     * @param token       ERC20 address users will bet with
     * @param strikePrice Current asset price × 1e8 (e.g. BTC $67500 → 6750000000000)
     */
    function openRound(address token, uint256 strikePrice) external onlyOwner returns (uint256 roundId) {
        require(supportedTokens[token], "Token not supported");
        roundId = nextRoundId++;
        rounds[roundId] = Round({
            id:           roundId,
            token:        token,
            strikePrice:  strikePrice,
            finalPrice:   0,
            openTime:     block.timestamp,
            closeTime:    block.timestamp + ROUND_DURATION,
            totalUpPool:  0,
            totalDownPool:0,
            winningSide:  0,
            settled:      false
        });
        emit RoundOpened(roundId, token, strikePrice, block.timestamp + ROUND_DURATION);
    }

    // ─── User: place bet ──────────────────────────────────────────────────────
    function placeBet(uint256 roundId, uint8 direction, uint256 amount) external {
        Round storage r = rounds[roundId];
        require(!r.settled,                          "Round settled");
        require(block.timestamp < r.closeTime,       "Round closed");
        require(direction == UP || direction == DOWN, "Invalid direction");
        require(amount > 0,                          "Zero amount");

        IERC20(r.token).transferFrom(msg.sender, address(this), amount);

        uint256 betIndex = roundBets[roundId].length;
        roundBets[roundId].push(Bet({
            bettor:    msg.sender,
            amount:    amount,
            direction: direction,
            claimed:   false
        }));
        userBetIndexes[roundId][msg.sender].push(betIndex);

        if (direction == UP) {
            r.totalUpPool += amount;
        } else {
            r.totalDownPool += amount;
        }

        emit BetPlaced(roundId, msg.sender, direction, amount);
    }

    // ─── Admin: settle round ──────────────────────────────────────────────────
    /**
     * @param finalPrice Asset price × 1e8 at settlement time
     */
    function settleRound(uint256 roundId, uint256 finalPrice) external onlyOwner {
        Round storage r = rounds[roundId];
        require(!r.settled,                    "Already settled");
        require(block.timestamp >= r.closeTime,"Round still open");

        r.finalPrice = finalPrice;
        r.settled    = true;

        if (finalPrice > r.strikePrice) {
            r.winningSide = UP;
        } else if (finalPrice < r.strikePrice) {
            r.winningSide = DOWN;
        } else {
            r.winningSide = 3; // tie → full refund
        }

        emit RoundSettled(roundId, finalPrice, r.winningSide);
    }

    // ─── User: claim winnings ─────────────────────────────────────────────────
    function claimWinnings(uint256 roundId) external {
        Round storage r = rounds[roundId];
        require(r.settled, "Not settled yet");

        uint256[] storage indexes = userBetIndexes[roundId][msg.sender];
        require(indexes.length > 0, "No bets");

        uint256 totalPayout;
        uint256 totalPool = r.totalUpPool + r.totalDownPool;

        for (uint256 i = 0; i < indexes.length; i++) {
            Bet storage bet = roundBets[roundId][indexes[i]];
            if (bet.claimed) continue;
            bet.claimed = true;

            if (r.winningSide == 3) {
                // Tie: full refund
                totalPayout += bet.amount;
            } else if (bet.direction == r.winningSide) {
                // Winner: stake back + proportional share of loser pool minus fee
                uint256 loserPool = (bet.direction == UP) ? r.totalDownPool : r.totalUpPool;
                uint256 winnerPool= totalPool - loserPool;
                if (winnerPool == 0) {
                    totalPayout += bet.amount; // edge case: no losers
                } else {
                    uint256 grossShare = (bet.amount * loserPool) / winnerPool;
                    uint256 fee        = (grossShare * HOUSE_FEE_BPS) / 10_000;
                    totalPayout += bet.amount + grossShare - fee;
                    // Transfer fee to house
                    if (fee > 0) {
                        IERC20(r.token).transfer(feeReceiver, fee);
                    }
                }
            }
            // Loser: no payout (amount stays in contract distributed to winners)
        }

        require(totalPayout > 0, "Nothing to claim");
        IERC20(r.token).transfer(msg.sender, totalPayout);
        emit WinningsClaimed(roundId, msg.sender, totalPayout);
    }

    // ─── Views ────────────────────────────────────────────────────────────────
    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function getUserBets(uint256 roundId, address user) external view returns (Bet[] memory) {
        uint256[] storage indexes = userBetIndexes[roundId][user];
        Bet[] memory bets = new Bet[](indexes.length);
        for (uint256 i = 0; i < indexes.length; i++) {
            bets[i] = roundBets[roundId][indexes[i]];
        }
        return bets;
    }

    function getActiveBettors(uint256 roundId) external view returns (uint256 upCount, uint256 downCount) {
        Bet[] storage bets = roundBets[roundId];
        for (uint256 i = 0; i < bets.length; i++) {
            if (bets[i].direction == UP)   upCount++;
            else                           downCount++;
        }
    }

    function getSupportedTokens() external view returns (address[] memory) {
        return tokenList;
    }
}
