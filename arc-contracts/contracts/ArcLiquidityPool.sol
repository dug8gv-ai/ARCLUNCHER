// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract ArcLiquidityPool {
    IERC20 public usdc;
    IERC20 public eurc;
    
    address public admin;
    
    uint256 public reserveUSDC;
    uint256 public reserveEURC;
    
    // Flat fee: 0.1 tokens (100000 for 6 decimal tokens like USDC/EURC)
    uint256 public constant FLAT_FEE = 100000; // 0.1 tokens (6 decimals)
    
    uint256 public collectedFeesUSDC;
    uint256 public collectedFeesEURC;

    struct Stake {
        uint256 totalUSDC;
        uint256 totalEURC;
        uint256 withdrawnUSDC;
        uint256 withdrawnEURC;
        uint256 withdrawalStartTime;
    }
    
    mapping(address => Stake) public userStakes;
    
    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event WithdrawalInitiated(address indexed provider, uint256 instantUsdc, uint256 instantEurc);
    event VestedClaimed(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event Swapped(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee);
    event FeesWithdrawn(address indexed admin, uint256 usdcFees, uint256 eurcFees);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }
    
    constructor(address _usdc, address _eurc, address _admin) {
        usdc = IERC20(_usdc);
        eurc = IERC20(_eurc);
        admin = _admin;
    }
    
    // ========== PUBLIC: LIQUIDITY PROVISION (1:1) ==========
    
    function addLiquidity(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        
        Stake storage stake = userStakes[msg.sender];
        require(stake.withdrawalStartTime == 0, "Cannot add liquidity while in withdrawal phase");

        usdc.transferFrom(msg.sender, address(this), amount);
        eurc.transferFrom(msg.sender, address(this), amount);
        
        reserveUSDC += amount;
        reserveEURC += amount;
        
        stake.totalUSDC += amount;
        stake.totalEURC += amount;
        
        emit LiquidityAdded(msg.sender, amount, amount);
    }
    
    // ========== PUBLIC: THE 25/10 WITHDRAWAL RULE ==========
    
    function initiateWithdrawal() external {
        Stake storage stake = userStakes[msg.sender];
        require(stake.totalUSDC > 0, "No liquidity staked");
        require(stake.withdrawalStartTime == 0, "Withdrawal already initiated");
        
        stake.withdrawalStartTime = block.timestamp;
        
        // 25% Instant
        uint256 instantUSDC = (stake.totalUSDC * 25) / 100;
        uint256 instantEURC = (stake.totalEURC * 25) / 100;
        
        stake.withdrawnUSDC += instantUSDC;
        stake.withdrawnEURC += instantEURC;
        
        reserveUSDC -= instantUSDC;
        reserveEURC -= instantEURC;
        
        usdc.transfer(msg.sender, instantUSDC);
        eurc.transfer(msg.sender, instantEURC);
        
        emit WithdrawalInitiated(msg.sender, instantUSDC, instantEURC);
    }
    
    function claimVested() external {
        Stake storage stake = userStakes[msg.sender];
        require(stake.withdrawalStartTime > 0, "Withdrawal not initiated");
        
        uint256 weeksPassed = (block.timestamp - stake.withdrawalStartTime) / 1 weeks;
        if (weeksPassed > 10) weeksPassed = 10; // Max 100% after 7.5 weeks (25% + 75%)
        
        // Allowed percentage: 25 + (10 * weeksPassed)
        uint256 allowedPercent = 25 + (10 * weeksPassed);
        if (allowedPercent > 100) allowedPercent = 100;
        
        uint256 allowedUSDC = (stake.totalUSDC * allowedPercent) / 100;
        uint256 allowedEURC = (stake.totalEURC * allowedPercent) / 100;
        
        uint256 claimableUSDC = allowedUSDC - stake.withdrawnUSDC;
        uint256 claimableEURC = allowedEURC - stake.withdrawnEURC;
        
        require(claimableUSDC > 0 || claimableEURC > 0, "Nothing to claim yet");
        
        stake.withdrawnUSDC += claimableUSDC;
        stake.withdrawnEURC += claimableEURC;
        
        reserveUSDC -= claimableUSDC;
        reserveEURC -= claimableEURC;
        
        if (claimableUSDC > 0) usdc.transfer(msg.sender, claimableUSDC);
        if (claimableEURC > 0) eurc.transfer(msg.sender, claimableEURC);
        
        // Clean up if fully withdrawn
        if (stake.withdrawnUSDC >= stake.totalUSDC) {
            delete userStakes[msg.sender];
        }
        
        emit VestedClaimed(msg.sender, claimableUSDC, claimableEURC);
    }

    // Return current withdrawable amount
    function getWithdrawable(address user) external view returns (uint256 claimableUSDC, uint256 claimableEURC) {
        Stake storage stake = userStakes[user];
        if (stake.withdrawalStartTime == 0) return (0, 0); // Need to initiate
        
        uint256 weeksPassed = (block.timestamp - stake.withdrawalStartTime) / 1 weeks;
        uint256 allowedPercent = 25 + (10 * weeksPassed);
        if (allowedPercent > 100) allowedPercent = 100;
        
        uint256 allowedUSDC = (stake.totalUSDC * allowedPercent) / 100;
        uint256 allowedEURC = (stake.totalEURC * allowedPercent) / 100;
        
        claimableUSDC = allowedUSDC - stake.withdrawnUSDC;
        claimableEURC = allowedEURC - stake.withdrawnEURC;
    }
    
    // ========== PUBLIC: SWAP FUNCTIONS ==========
    
    function swapUSDCtoEURC(uint256 usdcAmountIn) external returns (uint256 eurcAmountOut) {
        require(usdcAmountIn > FLAT_FEE, "Amount must be greater than fee");
        require(reserveUSDC > 0 && reserveEURC > 0, "Liquidity run out - pool is empty");
        
        uint256 amountAfterFee = usdcAmountIn - FLAT_FEE;
        
        // Fixed rate: 1 USDC = 0.9174 EURC
        eurcAmountOut = (amountAfterFee * 9174) / 10000;
        
        require(eurcAmountOut > 0 && eurcAmountOut < reserveEURC, "Liquidity run out - insufficient EURC in pool");
        
        usdc.transferFrom(msg.sender, address(this), usdcAmountIn);
        eurc.transfer(msg.sender, eurcAmountOut);
        
        // Fee auto-compounds into pool reserves!
        reserveUSDC += usdcAmountIn; 
        reserveEURC -= eurcAmountOut;
        
        collectedFeesUSDC += FLAT_FEE;
        
        emit Swapped(msg.sender, address(usdc), address(eurc), usdcAmountIn, eurcAmountOut, FLAT_FEE);
    }
    
    function swapEURCtoUSDC(uint256 eurcAmountIn) external returns (uint256 usdcAmountOut) {
        require(eurcAmountIn > FLAT_FEE, "Amount must be greater than fee");
        require(reserveUSDC > 0 && reserveEURC > 0, "Liquidity run out - pool is empty");
        
        uint256 amountAfterFee = eurcAmountIn - FLAT_FEE;
        
        // Fixed rate: 1 EURC = 1.09 USDC
        usdcAmountOut = (amountAfterFee * 10900) / 10000;
        
        require(usdcAmountOut > 0 && usdcAmountOut < reserveUSDC, "Liquidity run out - insufficient USDC in pool");
        
        eurc.transferFrom(msg.sender, address(this), eurcAmountIn);
        usdc.transfer(msg.sender, usdcAmountOut);
        
        // Fee auto-compounds into pool reserves
        reserveEURC += eurcAmountIn;
        reserveUSDC -= usdcAmountOut;
        
        collectedFeesEURC += FLAT_FEE;
        
        emit Swapped(msg.sender, address(eurc), address(usdc), eurcAmountIn, usdcAmountOut, FLAT_FEE);
    }
    
    function getSwapEstimate(bool usdcToEurc, uint256 amountIn) external view returns (uint256 amountOut) {
        if (reserveUSDC == 0 || reserveEURC == 0) return 0;
        if (amountIn <= FLAT_FEE) return 0;
        
        uint256 amountAfterFee = amountIn - FLAT_FEE;
        
        if (usdcToEurc) {
            // 1 USDC = 0.9174 EURC
            amountOut = (amountAfterFee * 9174) / 10000;
        } else {
            // 1 EURC = 1.09 USDC
            amountOut = (amountAfterFee * 10900) / 10000;
        }
    }
}
