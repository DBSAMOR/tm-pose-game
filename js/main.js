/**
 * main.js
 * 포즈 인식과 게임 로직을 초기화하고 서로 연결하는 진입점
 *
 * PoseEngine, GameEngine, Stabilizer를 조합하여 애플리케이션을 구동
 */

// 전역 변수
let poseEngine;
let gameEngine;
let stabilizer;
let ctx;
let labelContainer;

/**
 * 애플리케이션 초기화
 */
async function init() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  startBtn.disabled = true;

  try {
    // 1. PoseEngine 초기화 (모델 경로 수정!)
    poseEngine = new PoseEngine("./my-model/");
    const { maxPredictions, webcam } = await poseEngine.init({
      size: 200,
      flip: true
    });

    // 2. Stabilizer 초기화
    stabilizer = new PredictionStabilizer({
      threshold: 0.7,
      smoothingFrames: 3
    });

    // 3. GameEngine 초기화
    gameEngine = new GameEngine();
    setupGameCallbacks();

    // 4. 캔버스 설정 (게임 영역 내 웹캠용)
    const gameCanvas = document.getElementById("game-canvas");
    gameCanvas.width = 150;
    gameCanvas.height = 150;
    ctx = gameCanvas.getContext("2d");

    // 하단 디버그용 캔버스
    const canvas = document.getElementById("canvas");
    canvas.width = 200;
    canvas.height = 200;

    // 5. Label Container 설정
    labelContainer = document.getElementById("label-container");
    labelContainer.innerHTML = ""; // 초기화
    for (let i = 0; i < maxPredictions; i++) {
      labelContainer.appendChild(document.createElement("div"));
    }

    // 6. PoseEngine 콜백 설정
    poseEngine.setPredictionCallback(handlePrediction);
    poseEngine.setDrawCallback(drawPose);

    // 7. PoseEngine 시작
    poseEngine.start();

    // 8. 게임 자동 시작
    gameEngine.start();

    stopBtn.disabled = false;
    console.log("초기화 완료! 게임 시작!");
  } catch (error) {
    console.error("초기화 중 오류 발생:", error);
    alert("초기화에 실패했습니다. 콘솔을 확인하세요.");
    startBtn.disabled = false;
  }
}

/**
 * 게임 엔진 콜백 설정
 */
function setupGameCallbacks() {
  // 점수 변경 콜백
  gameEngine.setScoreChangeCallback((data) => {
    document.getElementById("score-display").textContent = data.score;
    document.getElementById("level-display").textContent = data.level;
    document.getElementById("miss-display").textContent = `${data.missCount}/${data.maxMisses}`;
    document.getElementById("combo-display").textContent = data.combo;
  });

  // 아이템 생성 콜백
  gameEngine.setItemCreateCallback((item, fallDuration) => {
    const itemsContainer = document.getElementById("items-container");
    const itemElement = document.createElement("div");
    itemElement.className = "item";
    itemElement.id = `item-${item.id}`;
    itemElement.textContent = gameEngine.itemTypes[item.type].emoji;

    // 초기 위치 설정
    const zonePositions = {
      "LEFT": "16.67%",
      "CENTER": "50%",
      "RIGHT": "83.33%"
    };

    itemElement.style.left = zonePositions[item.zone];
    itemElement.style.transform = "translateX(-50%)";
    itemElement.style.top = "0px";

    itemsContainer.appendChild(itemElement);

    // 낙하 애니메이션
    setTimeout(() => {
      itemElement.style.transition = `top ${fallDuration}ms linear`;
      itemElement.style.top = "440px"; // 바구니 위치까지
    }, 10);
  });

  // 아이템 제거 콜백
  gameEngine.setItemRemoveCallback((itemId) => {
    const itemElement = document.getElementById(`item-${itemId}`);
    if (itemElement) {
      itemElement.remove();
    }
  });

  // 바구니 이동 콜백
  gameEngine.setBasketMoveCallback((position) => {
    const basket = document.getElementById("basket");
    basket.className = ""; // 기존 클래스 제거

    if (position === "LEFT") {
      basket.classList.add("basket-left");
    } else if (position === "CENTER") {
      basket.classList.add("basket-center");
    } else if (position === "RIGHT") {
      basket.classList.add("basket-right");
    }
  });

  // 게임 종료 콜백
  gameEngine.setGameEndCallback((data) => {
    document.getElementById("game-over-reason").textContent = data.reason;
    document.getElementById("final-score").textContent = data.score;
    document.getElementById("final-level").textContent = data.level;
    document.getElementById("final-fruits").textContent = data.fruitsCaught;

    const modal = document.getElementById("game-over-modal");
    modal.classList.remove("hidden");
  });
}

/**
 * 애플리케이션 중지
 */
function stop() {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");

  if (poseEngine) {
    poseEngine.stop();
  }

  if (gameEngine && gameEngine.isGameActive) {
    gameEngine.stop();
  }

  if (stabilizer) {
    stabilizer.reset();
  }

  startBtn.disabled = false;
  stopBtn.disabled = true;
}

/**
 * 게임 재시작
 */
function restartGame() {
  // 게임 오버 모달 숨기기
  const modal = document.getElementById("game-over-modal");
  modal.classList.add("hidden");

  // 아이템 컨테이너 초기화
  const itemsContainer = document.getElementById("items-container");
  itemsContainer.innerHTML = "";

  // 바구니 중앙으로 이동
  const basket = document.getElementById("basket");
  basket.className = "basket-center";

  // 게임 재시작
  if (gameEngine) {
    gameEngine.start();
  }
}

/**
 * 예측 결과 처리 콜백
 * @param {Array} predictions - TM 모델의 예측 결과
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function handlePrediction(predictions, pose) {
  // 1. Stabilizer로 예측 안정화
  const stabilized = stabilizer.stabilize(predictions);

  // 2. Label Container 업데이트
  for (let i = 0; i < predictions.length; i++) {
    const classPrediction =
      predictions[i].className + ": " + predictions[i].probability.toFixed(2);
    labelContainer.childNodes[i].innerHTML = classPrediction;
  }

  // 3. 최고 확률 예측 표시 (게임 영역과 하단 모두)
  const maxPredictionDiv = document.getElementById("max-prediction");
  const currentPoseDiv = document.getElementById("current-pose");
  const poseText = stabilized.className || "감지 중...";
  maxPredictionDiv.innerHTML = poseText;
  if (currentPoseDiv) {
    currentPoseDiv.innerHTML = poseText;
  }

  // 4. GameEngine에 포즈 전달 (게임 모드일 경우)
  if (gameEngine && gameEngine.isGameActive && stabilized.className) {
    gameEngine.onPoseDetected(stabilized.className);
  }
}

/**
 * 포즈 그리기 콜백
 * @param {Object} pose - PoseNet 포즈 데이터
 */
function drawPose(pose) {
  if (poseEngine.webcam && poseEngine.webcam.canvas) {
    ctx.drawImage(poseEngine.webcam.canvas, 0, 0);

    // 키포인트와 스켈레톤 그리기
    if (pose) {
      const minPartConfidence = 0.5;
      tmPose.drawKeypoints(pose.keypoints, minPartConfidence, ctx);
      tmPose.drawSkeleton(pose.keypoints, minPartConfidence, ctx);
    }
  }
}
