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

contract ArcGlobalVault {
    IERC20 public usdc;
    IERC20 public eurc;
    IERC20 public cirBTC;
    
    address public treasury;
    
    // Flat fees
    uint256 public constant FLAT_FEE_USDC = 100000; // 0.1 USDC (6 decimals)
    uint256 public constant FLAT_FEE_EURC = 100000000000000000; // 0.1 EURC (18 decimals)
    uint256 public constant FLAT_FEE_CIRBTC = 154; // ~154 Satoshis = $0.10 at 65k BTC (8 decimals)
    
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeDeducted
    );
    
    constructor(address _usdc, address _eurc, address _cirBTC, address _treasury) {
        usdc = IERC20(_usdc);
        eurc = IERC20(_eurc);
        cirBTC = IERC20(_cirBTC);
        treasury = _treasury;
    }
    
    // Single-hop atomic swap
    function executeSwap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid amount");
        require(tokenIn != tokenOut, "Same token");
        require(
            (tokenIn == address(usdc) || tokenIn == address(eurc) || tokenIn == address(cirBTC)) &&
            (tokenOut == address(usdc) || tokenOut == address(eurc) || tokenOut == address(cirBTC)),
            "Unsupported pair"
        );
        
        uint256 fee = 0;
        if (tokenIn == address(usdc)) {
            require(amountIn > FLAT_FEE_USDC, "Amount less than fee");
            fee = FLAT_FEE_USDC;
        } else if (tokenIn == address(eurc)) {
            require(amountIn > FLAT_FEE_EURC, "Amount less than fee");
            fee = FLAT_FEE_EURC;
        } else if (tokenIn == address(cirBTC)) {
            require(amountIn > FLAT_FEE_CIRBTC, "Amount less than fee");
            fee = FLAT_FEE_CIRBTC;
        }
        
        uint256 amountAfterFee = amountIn - fee;
        
        // Pull tokenIn from user
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        
        // Settle fee to treasury
        IERC20(tokenIn).transfer(treasury, fee);
        
        // Calculate Output (Simulated Fixed Rates)
        // USDC (6 dec), EURC (18 dec), cirBTC (8 dec)
        
        if (tokenIn == address(usdc) && tokenOut == address(eurc)) {
            // 1 USDC = 0.92 EURC
            // (amountAfterFee * 10^12) * 0.92 = amountOut in EURC
            amountOut = (amountAfterFee * 92 * 10**10);
        } 
        else if (tokenIn == address(eurc) && tokenOut == address(usdc)) {
            // 1 EURC = 1.09 USDC
            amountOut = (amountAfterFee * 109) / (100 * 10**12);
        }
        else if (tokenIn == address(usdc) && tokenOut == address(cirBTC)) {
            // 1 USDC = 1/65000 BTC
            // amountAfterFee (6 dec) -> scale to 8 dec -> / 65000
            amountOut = (amountAfterFee * 100) / 65000;
        }
        else if (tokenIn == address(cirBTC) && tokenOut == address(usdc)) {
            // 1 BTC = 65000 USDC
            // amountAfterFee (8 dec) -> scale to 6 dec -> * 65000
            amountOut = (amountAfterFee * 65000) / 100;
        }
        else if (tokenIn == address(eurc) && tokenOut == address(cirBTC)) {
            // 1 EURC = 1.09 USDC = 1.09/65000 BTC
            amountOut = (amountAfterFee * 109) / (65000 * 10**12);
        }
        else if (tokenIn == address(cirBTC) && tokenOut == address(eurc)) {
            // 1 BTC = 65000 USDC = 65000 * 0.92 EURC = 59800 EURC
            amountOut = (amountAfterFee * 59800 * 10**10);
        }
        
        require(amountOut > 0, "Output too small");
        
        // Pay target asset to user
        require(IERC20(tokenOut).balanceOf(address(this)) >= amountOut, "Vault insufficient liquidity");
        IERC20(tokenOut).transfer(msg.sender, amountOut);
        
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, fee);
    }
}
