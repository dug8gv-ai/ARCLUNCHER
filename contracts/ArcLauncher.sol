// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ArcToken is ERC20, Ownable {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address creator
    ) ERC20(name, symbol) Ownable(msg.sender) {
        _mint(creator, initialSupply);
    }
}

contract ArcLauncher {
    address public constant USDC_ADDRESS = 0x3600000000000000000000000000000000000000;
    uint256 public constant LAUNCH_FEE = 4 * 10**6; // 4 USDC
    
    event TokenLaunched(address indexed creator, address indexed tokenAddress, string name, string ticker, uint256 supply);
    event Swap(address indexed user, address indexed tokenAddress, uint256 usdcAmount, uint256 tokenAmount, bool isBuy);

    struct TokenInfo {
        address creator;
        string name;
        string ticker;
        uint256 supply;
    }

    mapping(address => TokenInfo) public tokens;

    function launchToken(string memory name, string memory ticker, uint256 supply) external {
        // In a real scenario, we would transfer USDC fee here
        // For testnet, we just deploy
        
        ArcToken newToken = new ArcToken(name, ticker, supply * 10**18, msg.sender);
        address tokenAddress = address(newToken);
        
        tokens[tokenAddress] = TokenInfo({
            creator: msg.sender,
            name: name,
            ticker: ticker,
            supply: supply
        });

        emit TokenLaunched(msg.sender, tokenAddress, name, ticker, supply);
    }

    function swap(address tokenAddress, uint256 usdcAmount, uint256 tokenAmount, bool isBuy) external {
        // This is a simplified swap logic for the testnet launchpad
        // In reality, it would interact with a bonding curve or liquidity pool
        emit Swap(msg.sender, tokenAddress, usdcAmount, tokenAmount, isBuy);
    }
}
