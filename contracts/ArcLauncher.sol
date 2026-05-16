// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

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
    uint256 public constant LAUNCH_FEE = 4 * 10**6; // 4 USDC (Assuming 6 decimals for logic, but native is 18)

    struct TokenInfo {
        address creator;
        string name;
        string ticker;
        uint256 supply;
        address tokenAddress;
    }

    mapping(string => address) public tickerToToken;
    mapping(address => TokenInfo) public tokens;

    event TokenLaunched(address indexed tokenAddress, string name, string ticker, uint256 supply, address indexed creator);
    event TokenSwapped(address indexed tokenAddress, address indexed user, uint256 usdcAmount, uint256 tokenAmount, bool isBuy);

    function launchToken(string memory name, string memory ticker, uint256 supply) external {
        // Native USDC is 18 decimals, standard is 6. We use the fee as defined.
        uint256 fee = 4 * 10**18; // Use 18 decimals for native USDC
        IERC20(USDC_ADDRESS).transferFrom(msg.sender, address(this), fee);

        uint256 totalMint = supply * 10**18;
        ArcToken newToken = new ArcToken(name, ticker, totalMint, address(this));
        address tokenAddr = address(newToken);
        
        tickerToToken[ticker] = tokenAddr;
        tokens[tokenAddr] = TokenInfo({
            creator: msg.sender,
            name: name,
            ticker: ticker,
            supply: totalMint,
            tokenAddress: tokenAddr
        });

        emit TokenLaunched(tokenAddr, name, ticker, totalMint, msg.sender);
    }

    function swap(address tokenAddress, uint256 usdcAmount, uint256 tokenAmount, bool isBuy) external {
        if (isBuy) {
            IERC20(USDC_ADDRESS).transferFrom(msg.sender, address(this), usdcAmount);
            IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        } else {
            IERC20(tokenAddress).transferFrom(msg.sender, address(this), tokenAmount);
            IERC20(USDC_ADDRESS).transfer(msg.sender, usdcAmount);
        }
        emit TokenSwapped(tokenAddress, msg.sender, usdcAmount, tokenAmount, isBuy);
    }
}
