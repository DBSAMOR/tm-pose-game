/**
 * gameEngine.js
 * 과일 캐치 게임 로직
 * 
 * 포즈 인식으로 바구니를 조작하여 떨어지는 과일을 받고 폭탄을 피하는 게임
 */

class GameEngine {
  constructor() {
    // 게임 상태
    this.score = 0;
    this.level = 1;
    this.missCount = 0;
    this.maxMisses = 3;
    this.combo = 0;
    this.isGameActive = false;
    this.fruitsCaught = 0;
    
    // 타이머
    this.gameStartTime = 0;
    this.levelUpTimer = null;
    this.itemSpawnTimer = null;
    
    // 바구니 위치 (LEFT, CENTER, RIGHT)
    this.basketPosition = "CENTER";
    
    // 아이템 배열
    this.items = [];
    this.itemIdCounter = 0;
    
    // 아이템 정의
    this.itemTypes = {
      apple: { emoji: "🍎", score: 100, isFruit: true },
      banana: { emoji: "🍌", score: 150, isFruit: true },
      watermelon: { emoji: "🍉", score: 200, isFruit: true },
      cherry: { emoji: "🍒", score: 250, isFruit: true },
      bomb: { emoji: "💣", score: 0, isFruit: false }
    };
    
    // 레벨별 설정
    this.levelConfig = {
      1: { fallDuration: 4000, bombProbability: 0.05 },
      2: { fallDuration: 3500, bombProbability: 0.05 },
      3: { fallDuration: 3000, bombProbability: 0.10 },
      4: { fallDuration: 2500, bombProbability: 0.10 },
      5: { fallDuration: 2000, bombProbability: 0.20 }
    };
    
    // 콜백
    this.onScoreChange = null;
    this.onItemCreate = null;
    this.onItemRemove = null;
    this.onBasketMove = null;
    this.onGameEnd = null;
    
    // 애니메이션
    this.animationId = null;
  }

  /**
   * 게임 시작
   */
  start() {
    this.isGameActive = true;
    this.score = 0;
    this.level = 1;
    this.missCount = 0;
    this.combo = 0;
    this.fruitsCaught = 0;
    this.basketPosition = "CENTER";
    this.items = [];
    this.itemIdCounter = 0;
    this.gameStartTime = Date.now();
    
    // UI 업데이트
    this.notifyScoreChange();
    
    // 레벨업 타이머 시작 (20초마다)
    this.startLevelUpTimer();
    
    // 아이템 생성 시작
    this.startItemSpawning();
    
    // 게임 루프 시작
    this.gameLoop();
    
    console.log("게임 시작!");
  }

  /**
   * 게임 중지
   */
  stop() {
    this.isGameActive = false;
    
    // 타이머 정리
    if (this.levelUpTimer) {
      clearInterval(this.levelUpTimer);
      this.levelUpTimer = null;
    }
    
    if (this.itemSpawnTimer) {
      clearTimeout(this.itemSpawnTimer);
      this.itemSpawnTimer = null;
    }
    
    // 애니메이션 정리
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // 모든 아이템 제거
    this.items.forEach(item => {
      if (this.onItemRemove) {
        this.onItemRemove(item.id);
      }
    });
    this.items = [];
    
    console.log("게임 중지");
  }

  /**
   * 레벨업 타이머 시작
   */
  startLevelUpTimer() {
    this.levelUpTimer = setInterval(() => {
      if (this.level < 5) {
        this.level++;
        this.notifyScoreChange();
        console.log(`레벨 ${this.level}로 상승!`);
      }
    }, 20000); // 20초마다
  }

  /**
   * 아이템 생성 시작
   */
  startItemSpawning() {
    const spawnItem = () => {
      if (!this.isGameActive) return;
      
      this.createItem();
      
      // 1.5~2.5초 랜덤 간격으로 다음 아이템 생성
      const delay = 1500 + Math.random() * 1000;
      this.itemSpawnTimer = setTimeout(spawnItem, delay);
    };
    
    spawnItem();
  }

  /**
   * 아이템 생성
   */
  createItem() {
    const item = {
      id: this.itemIdCounter++,
      type: this.selectItemType(),
      zone: this.selectRandomZone(),
      y: 0, // 시작 위치 (상단)
      createdAt: Date.now()
    };
    
    this.items.push(item);
    
    // UI에 아이템 생성 알림
    if (this.onItemCreate) {
      const config = this.levelConfig[Math.min(this.level, 5)];
      this.onItemCreate(item, config.fallDuration);
    }
  }

  /**
   * 레벨별 확률로 아이템 타입 선택
   */
  selectItemType() {
    const rand = Math.random();
    const level = Math.min(this.level, 5);
    
    // 레벨별 확률 설정
    let probabilities;
    if (level <= 2) {
      probabilities = {
        apple: 0.40,
        banana: 0.30,
        watermelon: 0.20,
        cherry: 0.05,
        bomb: 0.05
      };
    } else if (level <= 4) {
      probabilities = {
        apple: 0.30,
        banana: 0.25,
        watermelon: 0.25,
        cherry: 0.10,
        bomb: 0.10
      };
    } else {
      probabilities = {
        apple: 0.25,
        banana: 0.20,
        watermelon: 0.20,
        cherry: 0.15,
        bomb: 0.20
      };
    }
    
    // 누적 확률로 선택
    let cumulative = 0;
    for (const [type, prob] of Object.entries(probabilities)) {
      cumulative += prob;
      if (rand < cumulative) {
        return type;
      }
    }
    
    return "apple"; // 기본값
  }

  /**
   * 랜덤 구역 선택
   */
  selectRandomZone() {
    const zones = ["LEFT", "CENTER", "RIGHT"];
    return zones[Math.floor(Math.random() * zones.length)];
  }

  /**
   * 게임 루프
   */
  gameLoop() {
    if (!this.isGameActive) return;
    
    this.updateItems();
    
    this.animationId = requestAnimationFrame(() => this.gameLoop());
  }

  /**
   * 모든 아이템 업데이트
   */
  updateItems() {
    const now = Date.now();
    const config = this.levelConfig[Math.min(this.level, 5)];
    const itemsToRemove = [];
    
    this.items.forEach(item => {
      const elapsed = now - item.createdAt;
      const progress = elapsed / config.fallDuration;
      
      // 아이템이 바닥에 도달했는지 확인
      if (progress >= 1.0) {
        // 충돌 검사
        if (this.checkCollision(item)) {
          this.handleItemCatch(item);
        } else {
          this.handleItemMiss(item);
        }
        itemsToRemove.push(item.id);
      }
    });
    
    // 제거할 아이템 처리
    itemsToRemove.forEach(id => {
      const index = this.items.findIndex(item => item.id === id);
      if (index !== -1) {
        this.items.splice(index, 1);
      }
      
      if (this.onItemRemove) {
        this.onItemRemove(id);
      }
    });
  }

  /**
   * 충돌 검사
   */
  checkCollision(item) {
    return item.zone === this.basketPosition;
  }

  /**
   * 아이템 캐치 처리
   */
  handleItemCatch(item) {
    const itemData = this.itemTypes[item.type];
    
    if (itemData.isFruit) {
      // 과일 캐치
      this.score += itemData.score;
      this.combo++;
      this.fruitsCaught++;
      
      // 콤보 보너스
      if (this.combo === 5) {
        this.score += 50;
        console.log("5콤보 달성! +50점 보너스");
      } else if (this.combo === 10) {
        this.score += 100;
        console.log("10콤보 달성! +100점 보너스");
      }
      
      this.notifyScoreChange();
      console.log(`${itemData.emoji} 캐치! +${itemData.score}점 (콤보: ${this.combo})`);
    } else {
      // 폭탄 캐치 - 게임 오버
      console.log("💣 폭탄 캐치! 게임 오버");
      this.endGame("폭탄을 받았습니다!");
    }
  }

  /**
   * 아이템 놓침 처리
   */
  handleItemMiss(item) {
    const itemData = this.itemTypes[item.type];
    
    if (itemData.isFruit) {
      // 과일 놓침
      this.missCount++;
      this.combo = 0; // 콤보 리셋
      this.notifyScoreChange();
      
      console.log(`${itemData.emoji} 놓침! (${this.missCount}/${this.maxMisses})`);
      
      // 3번 놓치면 게임 오버
      if (this.missCount >= this.maxMisses) {
        console.log("과일을 3번 놓쳤습니다! 게임 오버");
        this.endGame("과일을 3번 놓쳤습니다!");
      }
    } else {
      // 폭탄 놓침 - 괜찮음
      console.log("💣 폭탄 회피!");
    }
  }

  /**
   * 포즈 감지 처리
   */
  onPoseDetected(pose) {
    if (!this.isGameActive) return;
    
    // 포즈를 구역으로 매핑
    const poseToZone = {
      "좌": "LEFT",
      "중앙": "CENTER",
      "우": "RIGHT"
    };
    
    const newPosition = poseToZone[pose];
    
    if (newPosition && newPosition !== this.basketPosition) {
      this.basketPosition = newPosition;
      
      // UI에 바구니 이동 알림
      if (this.onBasketMove) {
        this.onBasketMove(this.basketPosition);
      }
      
      console.log(`바구니 이동: ${this.basketPosition}`);
    }
  }

  /**
   * 점수 변경 알림
   */
  notifyScoreChange() {
    if (this.onScoreChange) {
      this.onScoreChange({
        score: this.score,
        level: this.level,
        missCount: this.missCount,
        maxMisses: this.maxMisses,
        combo: this.combo
      });
    }
  }

  /**
   * 게임 종료
   */
  endGame(reason) {
    this.isGameActive = false;
    
    // 타이머 정리
    if (this.levelUpTimer) {
      clearInterval(this.levelUpTimer);
      this.levelUpTimer = null;
    }
    
    if (this.itemSpawnTimer) {
      clearTimeout(this.itemSpawnTimer);
      this.itemSpawnTimer = null;
    }
    
    // 애니메이션 정리
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    // 게임 오버 콜백
    if (this.onGameEnd) {
      this.onGameEnd({
        reason: reason,
        score: this.score,
        level: this.level,
        fruitsCaught: this.fruitsCaught
      });
    }
  }

  /**
   * 점수 변경 콜백 설정
   */
  setScoreChangeCallback(callback) {
    this.onScoreChange = callback;
  }

  /**
   * 아이템 생성 콜백 설정
   */
  setItemCreateCallback(callback) {
    this.onItemCreate = callback;
  }

  /**
   * 아이템 제거 콜백 설정
   */
  setItemRemoveCallback(callback) {
    this.onItemRemove = callback;
  }

  /**
   * 바구니 이동 콜백 설정
   */
  setBasketMoveCallback(callback) {
    this.onBasketMove = callback;
  }

  /**
   * 게임 종료 콜백 설정
   */
  setGameEndCallback(callback) {
    this.onGameEnd = callback;
  }

  /**
   * 현재 게임 상태 반환
   */
  getGameState() {
    return {
      isActive: this.isGameActive,
      score: this.score,
      level: this.level,
      missCount: this.missCount,
      maxMisses: this.maxMisses,
      combo: this.combo,
      basketPosition: this.basketPosition,
      fruitsCaught: this.fruitsCaught
    };
  }
}

// 전역으로 내보내기
window.GameEngine = GameEngine;
