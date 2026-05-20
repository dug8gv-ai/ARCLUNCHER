// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ArcDefiRouter {
    address public constant DEAD_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    
    struct LockInfo {
        uint256 amount;
        uint256 unlockTime;
    }
    
    // Mapping from user => token => LockInfo
    mapping(address => mapping(address => LockInfo)) public userLocks;

    event Swap(address indexed user, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event Burn(address indexed user, address token, uint256 amount);
    event Lock(address indexed user, address token, uint256 amount, uint256 unlockTime);
    event Unlock(address indexed user, address token, uint256 amount);

    // Simple 1:1 Swap logic. 
    // WARNING: This contract MUST be funded with tokens to swap out.
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts) {
        require(block.timestamp <= deadline, "EXPIRED");
        require(path.length == 2, "ONLY_DIRECT_SWAP");
        
        address tokenIn = path[0];
        address tokenOut = path[1];
        
        // 1:1 Swap for simplicity in testing
        uint256 amountOut = amountIn;
        require(amountOut >= amountOutMin, "INSUFFICIENT_OUTPUT_AMOUNT");
        
        // Pull tokenIn from user
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "TRANSFER_IN_FAILED");
        
        // Push tokenOut to user
        require(IERC20(tokenOut).transfer(to, amountOut), "TRANSFER_OUT_FAILED");
        
        emit Swap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
        
        amounts = new uint256[](2);
        amounts[0] = amountIn;
        amounts[1] = amountOut;
        return amounts;
    }

    // Burn tokens by sending them to DEAD address
    function burn(address token, uint256 amount) external {
        require(IERC20(token).transferFrom(msg.sender, DEAD_ADDRESS, amount), "BURN_FAILED");
        emit Burn(msg.sender, token, amount);
    }

    // Lock tokens for a specific duration
    function lock(address token, uint256 amount, uint256 durationInSeconds) external {
        require(amount > 0, "AMOUNT_ZERO");
        require(durationInSeconds > 0, "DURATION_ZERO");

        // Transfer tokens to this contract
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "LOCK_TRANSFER_FAILED");

        LockInfo storage currentLock = userLocks[msg.sender][token];
        
        // If they already have a lock, add to it and extend duration
        currentLock.amount += amount;
        currentLock.unlockTime = block.timestamp + durationInSeconds;

        emit Lock(msg.sender, token, amount, currentLock.unlockTime);
    }

    // Unlock and withdraw tokens
    function unlock(address token) external {
        LockInfo storage currentLock = userLocks[msg.sender][token];
        require(currentLock.amount > 0, "NO_LOCKED_TOKENS");
        require(block.timestamp >= currentLock.unlockTime, "LOCKED");

        uint256 amountToSend = currentLock.amount;
        currentLock.amount = 0;
        currentLock.unlockTime = 0;

        require(IERC20(token).transfer(msg.sender, amountToSend), "UNLOCK_TRANSFER_FAILED");

        emit Unlock(msg.sender, token, amountToSend);
    }

    // Admin emergency withdrawal for unfunded tokens
    function emergencyWithdraw(address token, uint256 amount) external {
        require(IERC20(token).transfer(msg.sender, amount), "WITHDRAW_FAILED");
    }
}
