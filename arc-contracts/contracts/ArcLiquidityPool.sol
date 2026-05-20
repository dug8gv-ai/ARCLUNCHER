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
    
    // Fee: 0.3% (3/1000)
    uint256 public constant FEE_NUMERATOR = 3;
    uint256 public constant FEE_DENOMINATOR = 1000;
    
    // Events
    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event LiquidityRemoved(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event Swapped(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event TokenBurned(address indexed user, address token, uint256 amount);
    
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
        require(usdcAmount > 0 && eurcAmount > 0, "Amounts must be > 0");
        
        usdc.transferFrom(msg.sender, address(this), usdcAmount);
        eurc.transferFrom(msg.sender, address(this), eurcAmount);
        
        reserveUSDC += usdcAmount;
        reserveEURC += eurcAmount;
        
        emit LiquidityAdded(msg.sender, usdcAmount, eurcAmount);
    }
    
    function removeLiquidity(uint256 usdcAmount, uint256 eurcAmount) external onlyAdmin {
        require(usdcAmount <= reserveUSDC && eurcAmount <= reserveEURC, "Exceeds reserves");
        
        reserveUSDC -= usdcAmount;
        reserveEURC -= eurcAmount;
        
        usdc.transfer(msg.sender, usdcAmount);
        eurc.transfer(msg.sender, eurcAmount);
        
        emit LiquidityRemoved(msg.sender, usdcAmount, eurcAmount);
    }
    
    // ========== PUBLIC: SWAP FUNCTIONS ==========
    
    function swapUSDCtoEURC(uint256 usdcAmountIn) external returns (uint256 eurcAmountOut) {
        require(usdcAmountIn > 0, "Amount must be > 0");
        require(reserveUSDC > 0 && reserveEURC > 0, "No liquidity");
        
        uint256 amountInAfterFee = usdcAmountIn * (FEE_DENOMINATOR - FEE_NUMERATOR) / FEE_DENOMINATOR;
        
        // Constant product: x * y = k
        eurcAmountOut = (amountInAfterFee * reserveEURC) / (reserveUSDC + amountInAfterFee);
        
        require(eurcAmountOut > 0 && eurcAmountOut < reserveEURC, "Insufficient liquidity");
        
        usdc.transferFrom(msg.sender, address(this), usdcAmountIn);
        eurc.transfer(msg.sender, eurcAmountOut);
        
        reserveUSDC += usdcAmountIn;
        reserveEURC -= eurcAmountOut;
        
        emit Swapped(msg.sender, address(usdc), address(eurc), usdcAmountIn, eurcAmountOut);
    }
    
    function swapEURCtoUSDC(uint256 eurcAmountIn) external returns (uint256 usdcAmountOut) {
        require(eurcAmountIn > 0, "Amount must be > 0");
        require(reserveUSDC > 0 && reserveEURC > 0, "No liquidity");
        
        uint256 amountInAfterFee = eurcAmountIn * (FEE_DENOMINATOR - FEE_NUMERATOR) / FEE_DENOMINATOR;
        
        usdcAmountOut = (amountInAfterFee * reserveUSDC) / (reserveEURC + amountInAfterFee);
        
        require(usdcAmountOut > 0 && usdcAmountOut < reserveUSDC, "Insufficient liquidity");
        
        eurc.transferFrom(msg.sender, address(this), eurcAmountIn);
        usdc.transfer(msg.sender, usdcAmountOut);
        
        reserveEURC += eurcAmountIn;
        reserveUSDC -= usdcAmountOut;
        
        emit Swapped(msg.sender, address(eurc), address(usdc), eurcAmountIn, usdcAmountOut);
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
    
    function getSwapEstimate(bool usdcToEurc, uint256 amountIn) external view returns (uint256 amountOut) {
        if (reserveUSDC == 0 || reserveEURC == 0) return 0;
        
        uint256 amountInAfterFee = amountIn * (FEE_DENOMINATOR - FEE_NUMERATOR) / FEE_DENOMINATOR;
        
        if (usdcToEurc) {
            amountOut = (amountInAfterFee * reserveEURC) / (reserveUSDC + amountInAfterFee);
        } else {
            amountOut = (amountInAfterFee * reserveUSDC) / (reserveEURC + amountInAfterFee);
        }
    }
}
