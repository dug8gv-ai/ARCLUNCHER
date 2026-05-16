// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ArcLauncher
 * @dev High-Frequency Token Launchpad with Global Metrics on Arc Testnet
 */

interface IERC20 {
    // Note: We remove "returns (bool)" because the Arc system contract might return nothing (0x)
    function transferFrom(address sender, address recipient, uint256 amount) external;
    function transfer(address recipient, uint256 amount) external;
}

contract ArcLauncher {
    address public constant USDC = 0x3600000000000000000000000000000000000000; // Arc Testnet USDC ERC-20 Interface
    address public treasury;
    
    uint256 public constant LAUNCH_FEE = 4 * 10**6; // 4 USDC (assuming 6 decimals)
    uint256 public constant LP_ALLOCATION = 3 * 10**6; // 3 USDC
    uint256 public constant TREASURY_ALLOCATION = 1 * 10**6; // 1 USDC
    
    uint256 public totalTokensCreated;
    uint256 public totalMarketVolume;

    event TokenLaunched(address indexed creator, address indexed tokenAddress, string name, string ticker, uint256 supply);
    event Swap(address indexed user, address indexed tokenAddress, uint256 usdcAmount, uint256 tokenAmount, bool isBuy);

    constructor(address _treasury) {
        treasury = _treasury;
    }

    /**
     * @dev Launches a new token.
     * Requires 4 USDC fee to be approved beforehand.
     * Splits fee: 3 USDC to LP, 1 USDC to Treasury.
     * Note: In a real implementation, this function would deploy a new ERC20 token contract,
     * initialize the AMM pool with the LP_ALLOCATION and 99% of the token supply.
     */
    function launchToken(string memory name, string memory ticker, uint256 supply) external {
        // Transfer 4 USDC from user
        IERC20(USDC).transferFrom(msg.sender, address(this), LAUNCH_FEE);
        
        // Split the fee
        IERC20(USDC).transfer(treasury, TREASURY_ALLOCATION);
        
        // The remaining 3 USDC stays in this contract or is sent to the specific token's LP pool.
        
        // Mocking token deployment address
        address mockTokenAddress = address(uint160(uint(keccak256(abi.encodePacked(block.timestamp, msg.sender, name)))));

        totalTokensCreated += 1;
        totalMarketVolume += LAUNCH_FEE;

        emit TokenLaunched(msg.sender, mockTokenAddress, name, ticker, supply);
    }
    
    /**
     * @dev Emits a swap event to be picked up by Supabase indexer.
     */
    function swap(address tokenAddress, uint256 usdcAmount, uint256 tokenAmount, bool isBuy) external {
        if (isBuy) {
            IERC20(USDC).transferFrom(msg.sender, address(this), usdcAmount);
        } else {
            IERC20(USDC).transfer(msg.sender, usdcAmount);
        }
        
        totalMarketVolume += usdcAmount;
        emit Swap(msg.sender, tokenAddress, usdcAmount, tokenAmount, isBuy);
    }
}
