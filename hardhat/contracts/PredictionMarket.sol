// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract PredictionMarket {
    using SafeERC20 for IERC20;

    address public admin;

    enum MarketState { Active, Resolved, Deleted }
    enum Prediction { None, Yes, No }

    struct Market {
        string title;
        string imageUrl;
        uint256 expirationTime;
        uint256 resolvedTime;
        uint256 totalYesPool;
        uint256 totalNoPool;
        MarketState state;
        Prediction winningSide;
        IERC20 token; // USDC or EURC
    }

    struct Bet {
        uint256 amountYes;
        uint256 amountNo;
        bool claimed;
    }

    uint256 public nextMarketId;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Bet)) public bets;

    event MarketCreated(uint256 indexed marketId, string title, address token);
    event BetPlaced(uint256 indexed marketId, address indexed user, Prediction side, uint256 amount);
    event MarketResolved(uint256 indexed marketId, Prediction winningSide);
    event RewardClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event ExpiredPoolClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event MarketDeleted(uint256 indexed marketId);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function createMarket(
        string memory _title,
        string memory _imageUrl,
        uint256 _expirationTime,
        address _token
    ) external returns (uint256) {
        require(_expirationTime > block.timestamp, "Expiration must be in the future");
        require(_token != address(0), "Invalid token address");

        uint256 marketId = nextMarketId++;
        Market storage m = markets[marketId];
        m.title = _title;
        m.imageUrl = _imageUrl;
        m.expirationTime = _expirationTime;
        m.state = MarketState.Active;
        m.token = IERC20(_token);

        emit MarketCreated(marketId, _title, _token);
        return marketId;
    }

    function placeBet(uint256 _marketId, Prediction _side, uint256 _amount) external {
        require(_amount > 0, "Amount must be greater than zero");
        require(_side == Prediction.Yes || _side == Prediction.No, "Invalid prediction side");
        
        Market storage m = markets[_marketId];
        require(m.state == MarketState.Active, "Market is not active");
        require(block.timestamp < m.expirationTime, "Market betting has expired");

        m.token.safeTransferFrom(msg.sender, address(this), _amount);

        Bet storage b = bets[_marketId][msg.sender];
        if (_side == Prediction.Yes) {
            b.amountYes += _amount;
            m.totalYesPool += _amount;
        } else {
            b.amountNo += _amount;
            m.totalNoPool += _amount;
        }

        emit BetPlaced(_marketId, msg.sender, _side, _amount);
    }

    function resolveMarket(uint256 _marketId, Prediction _winningSide) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.state == MarketState.Active, "Market is not active");
        require(block.timestamp >= m.expirationTime, "Market hasn't expired yet");
        require(_winningSide == Prediction.Yes || _winningSide == Prediction.No, "Invalid side");

        m.state = MarketState.Resolved;
        m.winningSide = _winningSide;
        m.resolvedTime = block.timestamp;

        emit MarketResolved(_marketId, _winningSide);
    }

    function claimReward(uint256 _marketId) external {
        Market storage m = markets[_marketId];
        require(m.state == MarketState.Resolved, "Market is not resolved");
        require(block.timestamp <= m.resolvedTime + 7 days, "Claim window has expired");

        Bet storage b = bets[_marketId][msg.sender];
        require(!b.claimed, "Reward already claimed");

        uint256 userContribution = m.winningSide == Prediction.Yes ? b.amountYes : b.amountNo;
        require(userContribution > 0, "You did not bet on the winning side");

        uint256 totalWinnerPool = m.winningSide == Prediction.Yes ? m.totalYesPool : m.totalNoPool;
        uint256 totalLoserPool = m.winningSide == Prediction.Yes ? m.totalNoPool : m.totalYesPool;

        uint256 rewardShare = (userContribution * totalLoserPool) / totalWinnerPool;
        uint256 totalPayout = userContribution + rewardShare;

        b.claimed = true;
        m.token.safeTransfer(msg.sender, totalPayout);

        emit RewardClaimed(_marketId, msg.sender, totalPayout);
    }

    function claimExpiredPool(uint256 _marketId) external {
        Market storage m = markets[_marketId];
        require(m.state == MarketState.Resolved, "Market is not resolved");
        require(block.timestamp > m.resolvedTime + 7 days, "7-day winner claim window is still active");

        Bet storage b = bets[_marketId][msg.sender];
        require(!b.claimed, "You have already claimed");

        uint256 loserContribution = m.winningSide == Prediction.Yes ? b.amountNo : b.amountYes;
        require(loserContribution > 0, "You did not bet on the losing side");

        uint256 totalLoserPool = m.winningSide == Prediction.Yes ? m.totalNoPool : m.totalYesPool;
        
        // At this point, the contract holds whatever funds winners didn't claim.
        // We determine the proportion of the unclaimed pool based on the loser's original contribution.
        // For simplicity, we fallback to contract balance proportion or remaining losers pool logic.
        uint256 remainingContractBalance = m.token.balanceOf(address(this));
        uint256 payout = (loserContribution * remainingContractBalance) / totalLoserPool;

        b.claimed = true;
        m.token.safeTransfer(msg.sender, payout);

        emit ExpiredPoolClaimed(_marketId, msg.sender, payout);
    }

    function deleteTask(uint256 _marketId) external onlyAdmin {
        Market storage m = markets[_marketId];
        require(m.state != MarketState.Deleted, "Market already deleted");
        
        m.state = MarketState.Deleted;
        
        // Anyone can now theoretically pull their original funds back if we wanted, 
        // but as per requirement: strict authenticated override to purge malicious tasks.
        
        emit MarketDeleted(_marketId);
    }
}
