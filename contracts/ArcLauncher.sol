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
        uint256 totalMint = supply * 10**18;
        uint256 creatorAmount = totalMint / 100; // 1%
        uint256 poolAmount = totalMint - creatorAmount; // 99%
        
        ArcToken newToken = new ArcToken(name, ticker, totalMint, address(this));
        address tokenAddress = address(newToken);
        
        // Mint 1% to creator
        newToken.transfer(msg.sender, creatorAmount);
        // 99% remains in this contract for swaps
        
        tokens[tokenAddress] = TokenInfo({
            creator: msg.sender,
            name: name,
            ticker: ticker,
            supply: supply
        });

        emit TokenLaunched(msg.sender, tokenAddress, name, ticker, supply);
    }

    function swap(address tokenAddress, uint256 usdcAmount, uint256 tokenAmount, bool isBuy) external {
        if (isBuy) {
            // Take USDC from user
            IERC20(usdcAddress).transferFrom(msg.sender, address(this), usdcAmount);
            // Give Tokens to user
            ArcToken(tokenAddress).transfer(msg.sender, tokenAmount);
        } else {
            // Take Tokens from user
            ArcToken(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
            // Give USDC to user
            IERC20(usdcAddress).transfer(msg.sender, usdcAmount);
        }
        
        emit TokenSwapped(tokenAddress, msg.sender, usdcAmount, tokenAmount, isBuy);
    }
}
