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
    uint256 public platformFeeBps = 200; // 2% taken from jackpot payout

    uint256 public poolBalance;
    uint256 private nonce;

    // Stats
    uint256 public totalSpins;
    uint256 public totalJackpots;
    uint256 public globalVolume;
    uint256 public totalWallets;
    
    mapping(address => bool) public hasPlayed;
    mapping(address => uint256) public spinsSinceJackpot;
    mapping(address => uint256) public spendSinceJackpot;

    uint8 public constant SYMBOLS = 8;
    uint8 public constant JACKPOT_SYMBOL = 7;

    event Spin(address indexed player, uint8 s1, uint8 s2, uint8 s3, uint256 payout, uint256 cashback);
    event Jackpot(address indexed winner, uint256 amount);
    event Donate(address indexed donor, uint256 amount);

    modifier onlyOwner() { 
        require(msg.sender == owner, "not owner"); 
        _; 
    }

    constructor(address _usdc, address _treasury) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        owner = msg.sender;
    }

    function spin(uint256 seed) external returns (uint8 s1, uint8 s2, uint8 s3, bool wonJackpot, uint256 payout, uint256 cashback) {
        // Pull spin fee
        require(usdc.transferFrom(msg.sender, address(this), spinFee), "USDC pull failed");
        
        // Stats update
        if (!hasPlayed[msg.sender]) {
            hasPlayed[msg.sender] = true;
            totalWallets++;
        }
        totalSpins++;
        globalVolume += spinFee;
        spinsSinceJackpot[msg.sender]++;
        spendSinceJackpot[msg.sender] += spinFee;

        // Pseudo-random reels
        nonce++;
        uint256 r = uint256(keccak256(abi.encodePacked(
            block.prevrandao, block.timestamp, msg.sender, nonce, seed
        )));

        // Determine Forced Jackpot
        uint256 threshold = 5 + (r % 2); // 5 or 6
        bool forceJackpot = spinsSinceJackpot[msg.sender] >= threshold;

        if (forceJackpot) {
            s1 = JACKPOT_SYMBOL;
            s2 = JACKPOT_SYMBOL;
            s3 = JACKPOT_SYMBOL;
        } else {
            s1 = uint8(r % SYMBOLS);
            s2 = uint8((r >> 8) % SYMBOLS);
            s3 = uint8((r >> 16) % SYMBOLS);
            
            // Prevent accidental natural jackpot if not forced (to strictly control payouts)
            if (s1 == JACKPOT_SYMBOL && s2 == JACKPOT_SYMBOL && s3 == JACKPOT_SYMBOL) {
                s1 = 0; 
            }
        }

        if (s1 == JACKPOT_SYMBOL && s2 == JACKPOT_SYMBOL && s3 == JACKPOT_SYMBOL) {
            wonJackpot = true;
            
            // 90% to pool, 10% to treasury (no cashback on win)
            uint256 toPool = (spinFee * 90) / 100;
            poolBalance += toPool;
            usdc.transfer(treasury, spinFee - toPool);

            // Payout calculation: 1.25x window spend
            uint256 calculatedPayout = (spendSinceJackpot[msg.sender] * 125) / 100;
            
            // Cap payout at pool * 0.98 (platform keeps 2%)
            uint256 maxPayout = (poolBalance * 98) / 100;
            if (calculatedPayout > maxPayout) {
                calculatedPayout = maxPayout;
            }

            payout = calculatedPayout;
            poolBalance -= payout; // Subtract from pool

            // Reset user window
            spinsSinceJackpot[msg.sender] = 0;
            spendSinceJackpot[msg.sender] = 0;
            totalJackpots++;

            require(usdc.transfer(msg.sender, payout), "jackpot xfer failed");
            emit Jackpot(msg.sender, payout);
            
        } else {
            // Losing spin: 50% cashback, 40% to pool, 10% to treasury
            cashback = (spinFee * 50) / 100;
            uint256 toPool = (spinFee * 40) / 100;
            
            poolBalance += toPool;
            usdc.transfer(treasury, spinFee - cashback - toPool);
            
            require(usdc.transfer(msg.sender, cashback), "cashback xfer failed");
        }

        emit Spin(msg.sender, s1, s2, s3, payout, cashback);
    }

    function donate(uint256 amount) external {
        require(amount > 0, "Zero amount");
        require(usdc.transferFrom(msg.sender, address(this), amount), "USDC pull failed");
        
        if (!hasPlayed[msg.sender]) {
            hasPlayed[msg.sender] = true;
            totalWallets++;
        }
        
        poolBalance += amount;
        globalVolume += amount;
        
        emit Donate(msg.sender, amount);
    }

    // --- admin ---
    function setSpinFee(uint256 v) external onlyOwner { spinFee = v; }
    function setTreasury(address t) external onlyOwner { treasury = t; }
    function transferOwnership(address n) external onlyOwner { owner = n; }
}
