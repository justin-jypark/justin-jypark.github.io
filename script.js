(() => {
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.querySelector(".site-nav");

  if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
  }

  const canvas = document.getElementById("worm-canvas");
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("high-score");
  const stateEl = document.getElementById("game-state");
  const gameButtons = document.querySelectorAll("[data-action]");
  const directionButtons = document.querySelectorAll("[data-direction]");

  if (!canvas || !scoreEl || !highScoreEl || !stateEl) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const STORAGE_KEY = "justin-park-worm-high-score";
  const GRID = 24;
  const CELL = canvas.width / GRID;
  const TICK_MS = 120;

  const directions = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const game = {
    snake: [],
    direction: directions.right,
    pendingDirection: null,
    food: null,
    score: 0,
    highScore: readHighScore(),
    state: "ready",
    timerId: null,
    growthPending: 0,
  };

  function readHighScore() {
    try {
      const stored = Number(window.localStorage.getItem(STORAGE_KEY));
      return Number.isFinite(stored) && stored > 0 ? stored : 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(value) {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore storage failures.
    }
  }

  function clonePoint(point) {
    return { x: point.x, y: point.y };
  }

  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  function formatState(value) {
    switch (value) {
      case "running":
        return "Running";
      case "paused":
        return "Paused";
      case "gameover":
        return "Game Over";
      default:
        return "Ready";
    }
  }

  function updateHud() {
    scoreEl.textContent = String(game.score);
    highScoreEl.textContent = String(game.highScore);
    stateEl.textContent = formatState(game.state);
  }

  function stopLoop() {
    if (game.timerId !== null) {
      window.clearInterval(game.timerId);
      game.timerId = null;
    }
  }

  function startLoop() {
    if (game.timerId !== null) {
      return;
    }

    game.timerId = window.setInterval(step, TICK_MS);
  }

  function setPendingDirection(nextDirection) {
    if (game.state === "gameover") {
      return;
    }

    const basis = game.pendingDirection || game.direction;
    if (isOpposite(nextDirection, basis)) {
      return;
    }

    game.pendingDirection = nextDirection;
  }

  function resetGame() {
    stopLoop();
    game.snake = [
      { x: 12, y: 12 },
      { x: 11, y: 12 },
      { x: 10, y: 12 },
    ];
    game.direction = directions.right;
    game.pendingDirection = null;
    game.food = spawnFood();
    game.score = 0;
    game.growthPending = 0;
    game.state = "ready";
    updateHud();
    draw();
  }

  function startGame() {
    if (game.state === "running") {
      return;
    }

    if (game.state === "gameover") {
      resetGame();
    }

    game.state = "running";
    updateHud();
    startLoop();
  }

  function pauseGame() {
    if (game.state !== "running") {
      return;
    }

    game.state = "paused";
    stopLoop();
    updateHud();
  }

  function restartGame() {
    resetGame();
    startGame();
  }

  function gameOver() {
    game.state = "gameover";
    stopLoop();
    if (game.score > game.highScore) {
      game.highScore = game.score;
      saveHighScore(game.highScore);
    }
    updateHud();
    draw();
  }

  function spawnFood() {
    const occupied = new Set(game.snake.map((segment) => `${segment.x},${segment.y}`));
    const freeCells = [];

    for (let y = 0; y < GRID; y += 1) {
      for (let x = 0; x < GRID; x += 1) {
        const key = `${x},${y}`;
        if (!occupied.has(key)) {
          freeCells.push({ x, y });
        }
      }
    }

    if (!freeCells.length) {
      return { x: 0, y: 0 };
    }

    const index = Math.floor(Math.random() * freeCells.length);
    return freeCells[index];
  }

  function step() {
    if (game.state !== "running") {
      return;
    }

    if (game.pendingDirection) {
      game.direction = game.pendingDirection;
      game.pendingDirection = null;
    }

    const head = game.snake[0];
    const nextHead = {
      x: head.x + game.direction.x,
      y: head.y + game.direction.y,
    };

    const willEat = nextHead.x === game.food.x && nextHead.y === game.food.y;
    const occupiedSegments = willEat || game.growthPending > 0 ? game.snake : game.snake.slice(0, -1);
    const outOfBounds =
      nextHead.x < 0 || nextHead.x >= GRID || nextHead.y < 0 || nextHead.y >= GRID;
    if (outOfBounds) {
      gameOver();
      return;
    }

    const hitSelf = occupiedSegments.some(
      (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
    );
    if (hitSelf) {
      gameOver();
      return;
    }

    game.snake.unshift(nextHead);

    if (willEat) {
      game.score += 10;
      game.growthPending += 1;
      if (game.score > game.highScore) {
        game.highScore = game.score;
        saveHighScore(game.highScore);
      }
      game.food = spawnFood();
    }

    if (game.growthPending > 0) {
      game.growthPending -= 1;
    } else {
      game.snake.pop();
    }

    updateHud();
    draw();
  }

  function drawCell(x, y, color, radius = 5) {
    const px = x * CELL;
    const py = y * CELL;
    const size = CELL;

    ctx.fillStyle = color;
    ctx.beginPath();
    const inset = 1.5;
    const cellSize = size - inset * 2;
    const r = Math.max(0, Math.min(radius, cellSize / 2));
    const left = px + inset;
    const top = py + inset;
    const right = left + cellSize;
    const bottom = top + cellSize;

    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(left, top, cellSize, cellSize, r);
    } else {
      ctx.moveTo(left + r, top);
      ctx.lineTo(right - r, top);
      ctx.arcTo(right, top, right, top + r, r);
      ctx.lineTo(right, bottom - r);
      ctx.arcTo(right, bottom, right - r, bottom, r);
      ctx.lineTo(left + r, bottom);
      ctx.arcTo(left, bottom, left, bottom - r, r);
      ctx.lineTo(left, top + r);
      ctx.arcTo(left, top, left + r, top, r);
    }
    ctx.fill();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1;

    for (let i = 1; i < GRID; i += 1) {
      const offset = i * CELL;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, offset);
      ctx.lineTo(canvas.width, offset);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawOverlay(text) {
    ctx.save();
    ctx.fillStyle = "rgba(8, 11, 14, 0.66)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8efe5";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 28px Georgia, serif";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 - 18);
    ctx.font = "400 16px Georgia, serif";
    ctx.fillText("Press Start / Resume or use Space", canvas.width / 2, canvas.height / 2 + 20);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    if (game.food) {
      drawCell(game.food.x, game.food.y, "#f59e0b", 7);
    }

    game.snake.forEach((segment, index) => {
      const fill = index === 0 ? "#fef3c7" : "#7dd3fc";
      drawCell(segment.x, segment.y, fill, index === 0 ? 8 : 6);
    });

    if (game.state === "ready") {
      drawOverlay("Ready");
    } else if (game.state === "paused") {
      drawOverlay("Paused");
    } else if (game.state === "gameover") {
      drawOverlay("Game Over");
    }
  }

  function getStateSnapshot() {
    return {
      snake: game.snake.map(clonePoint),
      direction: { ...game.direction },
      food: game.food ? clonePoint(game.food) : null,
      score: game.score,
      highScore: game.highScore,
      state: game.state,
      timerActive: game.timerId !== null,
      growthPending: game.growthPending,
    };
  }

  function setFood(position) {
    if (
      !position ||
      !Number.isInteger(position.x) ||
      !Number.isInteger(position.y) ||
      position.x < 0 ||
      position.x >= GRID ||
      position.y < 0 ||
      position.y >= GRID
    ) {
      return false;
    }

    game.food = { x: position.x, y: position.y };
    draw();
    return true;
  }

  function handleDirectionFromString(directionName) {
    const nextDirection = directions[directionName];
    if (!nextDirection) {
      return;
    }

    if (game.state === "ready") {
      game.state = "running";
      startLoop();
    }

    setPendingDirection(nextDirection);
    updateHud();
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (key === " " || key === "spacebar") {
      event.preventDefault();
      if (game.state === "running") {
        pauseGame();
      } else if (game.state === "paused" || game.state === "ready") {
        startGame();
      } else if (game.state === "gameover") {
        restartGame();
      }
      return;
    }

    const keyMap = {
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
    };

    const directionName = keyMap[key];
    if (directionName) {
      event.preventDefault();
      handleDirectionFromString(directionName);
    }
  });

  gameButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.action;

      if (action === "start") {
        startGame();
      } else if (action === "pause") {
        pauseGame();
      } else if (action === "restart") {
        restartGame();
      }
    });
  });

  directionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      handleDirectionFromString(button.dataset.direction);
    });
  });

  resetGame();
  updateHud();
  draw();

  window.__wormGame = {
    getState: getStateSnapshot,
    setFood,
    start: startGame,
    pause: pauseGame,
    restart: restartGame,
  };
})();
