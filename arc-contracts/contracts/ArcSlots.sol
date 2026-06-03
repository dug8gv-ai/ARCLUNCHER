// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ArcSlots {
    IERC20 public immutable usdc;
    address public treasury;
    address public owner;

    uint256 public spinFee = 100_000; // 0.1 USDC (6 decimals)
    uint256 public poolBps = 9_000; // 90% to pool
    uint256 public platformFeeBps = 200; // 2% taken from jackpot payout

    uint256 public poolBalance;
    uint256 private nonce;

    uint8 public constant SYMBOLS = 6;
    uint8 public constant JACKPOT_SYMBOL = 5;

    event Spin(address indexed player, uint8 s1, uint8 s2, uint8 s3, uint256 payout);
    event Jackpot(address indexed winner, uint256 amount);

    modifier onlyOwner() { 
        require(msg.sender == owner, "not owner"); 
        _; 
    }

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        owner = msg.sender;
    }

    function spin(uint256 seed) external returns (uint8 s1, uint8 s2, uint8 s3, bool wonJackpot, uint256 payout) {
        // Pull spin fee
        require(usdc.transferFrom(msg.sender, address(this), spinFee), "USDC pull failed");

        // Split fee
        uint256 toPool = (spinFee * poolBps) / 10_000;
        uint256 toTreasury = spinFee - toPool;
        poolBalance += toPool;

        if (toTreasury > 0) {
            require(usdc.transfer(treasury, toTreasury), "treasury xfer failed");
        }

        // Pseudo-random reels
        nonce++;
        uint256 r = uint256(keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, msg.sender, nonce, seed
        )));

        s1 = uint8(r % SYMBOLS);
        s2 = uint8((r >> 8) % SYMBOLS);
        s3 = uint8((r >> 16) % SYMBOLS);

        if (s1 == JACKPOT_SYMBOL && s2 == JACKPOT_SYMBOL && s3 == JACKPOT_SYMBOL) {
            wonJackpot = true;
            uint256 fee = (poolBalance * platformFeeBps) / 10_000;
            payout = poolBalance - fee;
            poolBalance = 0;
            
            if (fee > 0) {
                usdc.transfer(treasury, fee);
            }
            require(usdc.transfer(msg.sender, payout), "jackpot xfer failed");
            emit Jackpot(msg.sender, payout);
        }

        emit Spin(msg.sender, s1, s2, s3, payout);
    }

    // --- admin ---
    function setSpinFee(uint256 v) external onlyOwner { spinFee = v; }
    
    function setSplit(uint256 _poolBps, uint256 _platformFeeBps) external onlyOwner {
        require(_poolBps <= 10_000 && _platformFeeBps <= 1_000, "bad bps");
        poolBps = _poolBps; 
        platformFeeBps = _platformFeeBps;
    }
    
    function setTreasury(address t) external onlyOwner { treasury = t; }
    
    function transferOwnership(address n) external onlyOwner { owner = n; }
}
