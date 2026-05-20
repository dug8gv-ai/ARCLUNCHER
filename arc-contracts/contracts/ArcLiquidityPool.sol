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
    
    // Admin - only this address can add/remove liquidity
    address public admin;
    
    // Pool reserves
    uint256 public reserveUSDC;
    uint256 public reserveEURC;
    
    // Flat fee: 1 token (1e6 for 6 decimal tokens like USDC/EURC)
    uint256 public constant FLAT_FEE = 1e6; // 1 USDC or 1 EURC
    
    // Collected fees
    uint256 public collectedFeesUSDC;
    uint256 public collectedFeesEURC;
    
    // Events
    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event LiquidityRemoved(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event Swapped(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 fee);
    event TokenBurned(address indexed user, address token, uint256 amount);
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
    
    // ========== ADMIN ONLY: LIQUIDITY FUNCTIONS ==========
    
    function addLiquidity(uint256 usdcAmount, uint256 eurcAmount) external onlyAdmin {
        if (usdcAmount > 0) {
            usdc.transferFrom(msg.sender, address(this), usdcAmount);
            reserveUSDC += usdcAmount;
        }
        if (eurcAmount > 0) {
            eurc.transferFrom(msg.sender, address(this), eurcAmount);
            reserveEURC += eurcAmount;
        }
        emit LiquidityAdded(msg.sender, usdcAmount, eurcAmount);
    }
    
    function removeLiquidity(uint256 usdcAmount, uint256 eurcAmount) external onlyAdmin {
        require(usdcAmount <= reserveUSDC && eurcAmount <= reserveEURC, "Exceeds reserves");
        
        if (usdcAmount > 0) {
            reserveUSDC -= usdcAmount;
            usdc.transfer(msg.sender, usdcAmount);
        }
        if (eurcAmount > 0) {
            reserveEURC -= eurcAmount;
            eurc.transfer(msg.sender, eurcAmount);
        }
        
        emit LiquidityRemoved(msg.sender, usdcAmount, eurcAmount);
    }
    
    function withdrawFees() external onlyAdmin {
        uint256 usdcFees = collectedFeesUSDC;
        uint256 eurcFees = collectedFeesEURC;
        collectedFeesUSDC = 0;
        collectedFeesEURC = 0;
        
        if (usdcFees > 0) usdc.transfer(msg.sender, usdcFees);
        if (eurcFees > 0) eurc.transfer(msg.sender, eurcFees);
        
        emit FeesWithdrawn(msg.sender, usdcFees, eurcFees);
    }
    
    // ========== PUBLIC: SWAP FUNCTIONS ==========
    
    function swapUSDCtoEURC(uint256 usdcAmountIn) external returns (uint256 eurcAmountOut) {
        require(usdcAmountIn > FLAT_FEE, "Amount must be greater than 1 USDC fee");
        require(reserveUSDC > 0 && reserveEURC > 0, "Liquidity run out - pool is empty");
        
        // Deduct flat fee of 1 USDC
        uint256 amountAfterFee = usdcAmountIn - FLAT_FEE;
        
        // Constant product: x * y = k
        eurcAmountOut = (amountAfterFee * reserveEURC) / (reserveUSDC + amountAfterFee);
        
        require(eurcAmountOut > 0 && eurcAmountOut < reserveEURC, "Liquidity run out - insufficient EURC in pool");
        
        // Transfer tokens
        usdc.transferFrom(msg.sender, address(this), usdcAmountIn);
        eurc.transfer(msg.sender, eurcAmountOut);
        
        // Update reserves (fee stays in contract, not in reserves)
        reserveUSDC += amountAfterFee;
        reserveEURC -= eurcAmountOut;
        collectedFeesUSDC += FLAT_FEE;
        
        emit Swapped(msg.sender, address(usdc), address(eurc), usdcAmountIn, eurcAmountOut, FLAT_FEE);
    }
    
    function swapEURCtoUSDC(uint256 eurcAmountIn) external returns (uint256 usdcAmountOut) {
        require(eurcAmountIn > FLAT_FEE, "Amount must be greater than 1 EURC fee");
        require(reserveUSDC > 0 && reserveEURC > 0, "Liquidity run out - pool is empty");
        
        // Deduct flat fee of 1 EURC
        uint256 amountAfterFee = eurcAmountIn - FLAT_FEE;
        
        // Constant product: x * y = k
        usdcAmountOut = (amountAfterFee * reserveUSDC) / (reserveEURC + amountAfterFee);
        
        require(usdcAmountOut > 0 && usdcAmountOut < reserveUSDC, "Liquidity run out - insufficient USDC in pool");
        
        // Transfer tokens
        eurc.transferFrom(msg.sender, address(this), eurcAmountIn);
        usdc.transfer(msg.sender, usdcAmountOut);
        
        // Update reserves
        reserveEURC += amountAfterFee;
        reserveUSDC -= usdcAmountOut;
        collectedFeesEURC += FLAT_FEE;
        
        emit Swapped(msg.sender, address(eurc), address(usdc), eurcAmountIn, usdcAmountOut, FLAT_FEE);
    }
    
    // ========== PUBLIC: BURN ANY TOKEN ==========
    
    function burnToken(address token, uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        IERC20(token).transferFrom(msg.sender, address(0xdead), amount);
        emit TokenBurned(msg.sender, token, amount);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    function getReserves() external view returns (uint256 _reserveUSDC, uint256 _reserveEURC) {
        return (reserveUSDC, reserveEURC);
    }
    
    function getCollectedFees() external view returns (uint256 _feesUSDC, uint256 _feesEURC) {
        return (collectedFeesUSDC, collectedFeesEURC);
    }
    
    function getSwapEstimate(bool usdcToEurc, uint256 amountIn) external view returns (uint256 amountOut) {
        if (reserveUSDC == 0 || reserveEURC == 0) return 0;
        if (amountIn <= FLAT_FEE) return 0;
        
        uint256 amountAfterFee = amountIn - FLAT_FEE;
        
        if (usdcToEurc) {
            amountOut = (amountAfterFee * reserveEURC) / (reserveUSDC + amountAfterFee);
        } else {
            amountOut = (amountAfterFee * reserveUSDC) / (reserveEURC + amountAfterFee);
        }
    }
}
