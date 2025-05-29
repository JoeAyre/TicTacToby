document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const cells = document.querySelectorAll('.cell');
    const statusMessage = document.getElementById('status-message');
    const resetButton = document.getElementById('reset-button');

    const onePlayerModeBtn = document.getElementById('one-player-mode-btn');
    const twoPlayerModeBtn = document.getElementById('two-player-mode-btn');
    const player1SetupArea = document.getElementById('player1-setup-area');
    const player2SetupArea = document.getElementById('player2-setup-area');
    const aiOpponentSelectionArea = document.getElementById('ai-opponent-selection-area');
    const aiOptions = document.querySelectorAll('.ai-option');
    const aiSelectedMessage = document.getElementById('ai-selected-message');
    const player1SetupTitle = document.getElementById('player1-setup-title');

    const playerNameInputs = [document.getElementById('player1-name'), document.getElementById('player2-name')];
    const imageInputs = document.querySelectorAll('.image-input');
    const previewImages = [document.getElementById('player1-preview'), document.getElementById('player2-preview')];

    const recordButtons = document.querySelectorAll('.record-button');
    const stopRecordButtons = document.querySelectorAll('.stop-record-button');
    const recordStatuses = document.querySelectorAll('.record-status');
    const playbackAudios = document.querySelectorAll('.playback-audio');

    const scorePlayer1NameDisplay = document.getElementById('score-player1-name');
    const scorePlayer2NameDisplay = document.getElementById('score-player2-name');
    const scorePlayer1ValueDisplay = document.getElementById('score-player1-value');
    const scorePlayer2ValueDisplay = document.getElementById('score-player2-value');

	const gameModeSelectionDiv = document.getElementById('game-mode-selection');
    const toggleConfigButton = document.getElementById('toggle-config-button');
    const playerSetupContainer = document.querySelector('.player-setup-container');
    const bodyElement = document.body;

    const cameraModal = document.getElementById('camera-modal');
    const cameraVideoStream = document.getElementById('camera-video-stream');
    const cameraCanvas = document.getElementById('camera-canvas');
    const captureImageButton = document.getElementById('capture-image-btn');
    const closeCameraButton = cameraModal.querySelector('.close-camera-btn');
    const takePhotoButtons = document.querySelectorAll('.take-photo-btn');
    const cameraModalPlayerName = document.getElementById('camera-modal-player-name');
    const cameraErrorMsg = cameraModal.querySelector('.camera-error-msg');

    const winMessageOverlay = document.getElementById('win-message-overlay');
    const winTextElement = document.getElementById('win-text');

    // --- Game State Variables ---
    let gameMode = 'twoPlayer';
    let selectedAI = null;
    const aiData = {
        'simple-simon': { name: 'Simple Simon', image: 'SS.png', sound: 'SS.mp3', level: 'easy' },
        'average-joe':  { name: 'Average Joe',  image: 'AJ.png', sound: 'AJ.mp3', level: 'medium' },
        'brainy-brian': { name: 'Brainy Brian', image: 'BB.png', sound: 'BB.mp3', level: 'hard' }
    };

    let playerNames = ["Player 1", "Player 2"];
    let currentPlayer;
    let startingPlayerForNextGame = 0;
    let boardState = Array(9).fill(null);
    let playerImages = [null, null];
    let playerAudioBlobs = [null, null];
    let playerAudioURLs = [null, null];
    let gameActive = true;
    let scorePlayer1 = 0;
    let scorePlayer2 = 0;
	
	let willBrainFartThisGame = false; // Flag if current game against BB is a "brain fart" game
	let aiMovesMadeThisBrainFartGame = 0; // Counter for AI moves in a flagged game

    let winAnimationTimeout = null;
	const synth = window.speechSynthesis;

    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    // --- Media State Variables ---
    // MAKE SURE THESE ARE DECLARED HERE:
    let mediaRecorders = [null, null];      // <<< LIKELY MISSING OR MISPLACED
    let audioChunks = [[], []];             // <<< LIKELY MISSING OR MISPLACED
    let currentCameraStream = null;
    let activePlayerForCamera = null;
	
    // --- Game Mode Selection ---
    function setGameMode(mode) {
        gameMode = mode;
        selectedAI = null;
        aiSelectedMessage.textContent = '';
        aiOptions.forEach(opt => opt.classList.remove('selected'));

        playerImages[1] = null;
        playerAudioBlobs[1] = null;
        playerAudioURLs[1] = null;
        previewImages[1].src = "#";
        previewImages[1].style.display = 'none';
        if (playbackAudios[1] && recordStatuses[1] && recordButtons[1] && stopRecordButtons[1]) {
             recordStatuses[1].textContent = 'No sound recorded.';
             playbackAudios[1].style.display = 'none';
             playbackAudios[1].src = '';
             recordButtons[1].textContent = 'Record Sound';
             stopRecordButtons[1].style.display = 'none';
        }

        if (mode === 'onePlayer') {
            onePlayerModeBtn.classList.add('active');
            twoPlayerModeBtn.classList.remove('active');
            player2SetupArea.style.display = 'none';
            aiOpponentSelectionArea.style.display = 'flex';
            player1SetupTitle.textContent = "Your Setup";
            playerNames[1] = "Computer";
        } else {
            twoPlayerModeBtn.classList.add('active');
            onePlayerModeBtn.classList.remove('active');
            player2SetupArea.style.display = 'flex';
            aiOpponentSelectionArea.style.display = 'none';
            player1SetupTitle.textContent = "Player 1 Setup";
            playerNames[1] = playerNameInputs[1].value.trim() || "Player 2";
        }
        let p1Score = scorePlayer1; let p2Score = scorePlayer2;
        resetGameLogicOnly();
        scorePlayer1 = p1Score; scorePlayer2 = p2Score;
        updateScoreboardDisplay();
        updateGameReadyStatus();
    }
    onePlayerModeBtn.addEventListener('click', () => setGameMode('onePlayer'));
    twoPlayerModeBtn.addEventListener('click', () => setGameMode('twoPlayer'));

	// --- MODIFIED: AI Opponent Selection click listener ---
		aiOptions.forEach(option => {
			option.addEventListener('click', () => {
				if (gameMode !== 'onePlayer') return;
				aiOptions.forEach(opt => opt.classList.remove('selected'));
				option.classList.add('selected');
				selectedAI = option.dataset.ai;
				const ai = aiData[selectedAI];

				playerNames[1] = ai.name;
				playerImages[1] = ai.image;
				playerAudioURLs[1] = ai.sound;
				previewImages[1].src = ai.image;
				previewImages[1].style.display = 'block';
				aiSelectedMessage.textContent = `Playing against ${ai.name}.`;

				// --- ADD BRAIN FART DECISION ON AI SELECTION ---
				if (selectedAI === 'brainy-brian') {
					const brainFartChanceThisGame = 0.25;
					willBrainFartThisGame = Math.random() < brainFartChanceThisGame;
					aiMovesMadeThisBrainFartGame = 0;
					if (willBrainFartThisGame) {
						console.log("BB: This upcoming game might have a brain fart!");
					}
				} else {
					willBrainFartThisGame = false;
				}
				// --- END ADD ---

				resetGameLogicOnly(); // Reset board when AI is chosen for a fresh start
				updateScoreboardDisplay();
				updateGameReadyStatus();

				if (gameMode === 'onePlayer' && currentPlayer === 1 && gameActive) {
					computerMove();
				}
			});
		});
	// --- END MODIFIED: AI Opponent Selection ---

	// --- Player Name Handling ---
	playerNameInputs.forEach((input, index) => {
        const defaultName = `Player ${index + 1}`;
        input.addEventListener('focus', () => {
            if (input.value === defaultName) {
                if (!(gameMode === 'onePlayer' && index === 1)) {
                    input.value = '';
                }
            }
        });
        input.addEventListener('input', () => {
            if (gameMode === 'onePlayer' && index === 1) return;
            let typedValue = input.value;
            if (typedValue.length > 20) {
                typedValue = typedValue.substring(0, 20); input.value = typedValue;
            }
            playerNames[index] = typedValue.trim() || (index === 0 ? "Player 1" : "Player 2");
            updateScoreboardDisplay(); updateGameReadyStatus();
        });
        input.addEventListener('blur', () => {
            if (gameMode === 'onePlayer' && index === 1) {
                playerNames[1] = selectedAI ? aiData[selectedAI].name : "Computer";
            } else {
                let finalValue = input.value.trim();
                if (finalValue === '') finalValue = defaultName;
                input.value = finalValue; playerNames[index] = finalValue;
            }
            updateScoreboardDisplay(); updateGameReadyStatus();
        });
    });

	// --- Scoreboard ---
	function updateScoreboardDisplay() {
		scorePlayer1NameDisplay.textContent = playerNames[0] || `Player 1`;
        scorePlayer2NameDisplay.textContent = playerNames[1] || (gameMode === 'onePlayer' && selectedAI ? aiData[selectedAI].name : `Player 2`);
		scorePlayer1ValueDisplay.textContent = scorePlayer1;
		scorePlayer2ValueDisplay.textContent = scorePlayer2;
	}

    // --- Collapsible Config ---
    toggleConfigButton.addEventListener('click', () => {
        playerSetupContainer.classList.toggle('collapsed');
			if (gameModeSelectionDiv) { // Check if the element exists
				gameModeSelectionDiv.classList.toggle('collapsed');
			}
        bodyElement.classList.toggle('config-collapsed');
        toggleConfigButton.textContent = playerSetupContainer.classList.contains('collapsed') ? 'Show Setup' : 'Hide Setup';
    });

    // --- Image Upload Handling ---
    function handleImageUpload(event) {
        const playerIndex = parseInt(event.target.dataset.player);
        if (gameMode === 'onePlayer' && playerIndex === 1) return;
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                playerImages[playerIndex] = e.target.result;
                previewImages[playerIndex].src = e.target.result;
                previewImages[playerIndex].style.display = 'block';
                updateGameReadyStatus();
            };
            reader.readAsDataURL(file);
        }
    }
    imageInputs.forEach(input => input.addEventListener('change', handleImageUpload));

    // --- Camera Functionality ---
    takePhotoButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            activePlayerForCamera = parseInt(e.target.dataset.player);
            if (gameMode === 'onePlayer' && activePlayerForCamera === 1) return;
            cameraModalPlayerName.textContent = playerNames[activePlayerForCamera];
            cameraErrorMsg.style.display = 'none'; cameraModal.style.display = 'flex'; startCamera();
        });
    });
    async function startCamera() { /* ... (full function from previous script) ... */
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            displayCameraError('Camera API not supported by your browser.');
            captureImageButton.disabled = true; return;
        }
        try {
            if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());
            currentCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
            cameraVideoStream.srcObject = currentCameraStream;
            cameraErrorMsg.style.display = 'none';
            captureImageButton.disabled = false;
        } catch (err) {
            console.error("Error accessing camera: ", err);
            let msg = "Could not access camera. ";
            if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") msg += "No camera found.";
            else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") msg += "Permission denied.";
            else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") msg += "Constraints not met.";
            else msg += "Unknown error.";
            displayCameraError(msg);
            captureImageButton.disabled = true;
        }
    }
    function displayCameraError(message) { cameraErrorMsg.textContent = message; cameraErrorMsg.style.display = 'block'; }
    function stopCamera() {
        if (currentCameraStream) currentCameraStream.getTracks().forEach(track => track.stop());
        currentCameraStream = null; cameraVideoStream.srcObject = null;
        cameraModal.style.display = 'none'; activePlayerForCamera = null;
    }
    closeCameraButton.addEventListener('click', stopCamera);
    cameraModal.addEventListener('click', (event) => { if (event.target === cameraModal) stopCamera(); });
    captureImageButton.addEventListener('click', () => {
        if (activePlayerForCamera === null || !currentCameraStream || !cameraVideoStream.videoWidth) return;
        cameraCanvas.width = cameraVideoStream.videoWidth; cameraCanvas.height = cameraVideoStream.videoHeight;
        const context = cameraCanvas.getContext('2d');
        context.drawImage(cameraVideoStream, 0, 0, cameraCanvas.width, cameraCanvas.height);
        const imageDataURL = cameraCanvas.toDataURL('image/png');
        playerImages[activePlayerForCamera] = imageDataURL;
        previewImages[activePlayerForCamera].src = imageDataURL;
        previewImages[activePlayerForCamera].style.display = 'block';
        updateGameReadyStatus(); stopCamera();
    });

    // --- Audio Recording Handling ---
    async function startRecording(playerIndex) { /* ... (full function from previous script) ... */
        if (gameMode === 'onePlayer' && playerIndex === 1) return;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Browser does not support audio recording.'); return;
        }
        recordButtons[playerIndex].disabled = true; stopRecordButtons[playerIndex].disabled = false;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : '';
            mediaRecorders[playerIndex] = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            audioChunks[playerIndex] = [];
            mediaRecorders[playerIndex].ondataavailable = e => audioChunks[playerIndex].push(e.data);
            mediaRecorders[playerIndex].onstop = () => {
                const blob = new Blob(audioChunks[playerIndex], { type: mediaRecorders[playerIndex].mimeType || 'audio/webm' });
                playerAudioBlobs[playerIndex] = blob;
                if (playerAudioURLs[playerIndex]) URL.revokeObjectURL(playerAudioURLs[playerIndex]);
                playerAudioURLs[playerIndex] = URL.createObjectURL(blob);
                playbackAudios[playerIndex].src = playerAudioURLs[playerIndex];
                playbackAudios[playerIndex].style.display = 'block';
                recordStatuses[playerIndex].textContent = 'Sound recorded!';
                stopRecordButtons[playerIndex].style.display = 'none';
                recordButtons[playerIndex].style.display = 'inline-block';
                recordButtons[playerIndex].textContent = 'Re-record';
                stream.getTracks().forEach(track => track.stop());
                updateGameReadyStatus();
                recordButtons[playerIndex].disabled = false; stopRecordButtons[playerIndex].disabled = true;
            };
            mediaRecorders[playerIndex].start();
            recordButtons[playerIndex].style.display = 'none';
            stopRecordButtons[playerIndex].style.display = 'inline-block';
            recordStatuses[playerIndex].textContent = 'Recording...';
            playbackAudios[playerIndex].style.display = 'none';
        } catch (err) {
            console.error('Mic error:', err); recordStatuses[playerIndex].textContent = 'Mic access error.';
            recordButtons[playerIndex].style.display = 'inline-block';
            stopRecordButtons[playerIndex].style.display = 'none';
            recordButtons[playerIndex].disabled = false; stopRecordButtons[playerIndex].disabled = true;
        }
    }
    function stopRecording(playerIndex) { /* ... (full function from previous script) ... */
        if (mediaRecorders[playerIndex] && mediaRecorders[playerIndex].state === "recording") {
            mediaRecorders[playerIndex].stop();
        }
    }
    recordButtons.forEach(button => button.addEventListener('click', (e) => startRecording(parseInt(e.target.dataset.player))));
    stopRecordButtons.forEach(button => button.addEventListener('click', (e) => stopRecording(parseInt(e.target.dataset.player))));

	// --- Game Logic ---
	function updateGameReadyStatus() {
        let p1NameSet = playerNames[0] && playerNames[0].trim() !== '';
        let p1ImageSet = playerImages[0] !== null;
        let p1Ready = p1NameSet && p1ImageSet;
        let p2Ready = false;
        let missing = [];

        if (gameMode === 'onePlayer') {
            if (!selectedAI) missing.push("Select AI Opponent");
            else p2Ready = true;
        } else {
            let p2NameSet = playerNames[1] && playerNames[1].trim() !== '';
            let p2ImageSet = playerImages[1] !== null;
            p2Ready = p2NameSet && p2ImageSet;
            if (!p2NameSet) missing.push("P2 Name");
            if (!p2ImageSet) missing.push("P2 Image");
        }
        if (!p1NameSet) missing.push("P1 Name");
        if (!p1ImageSet) missing.push("P1 Image");

        if (gameActive) {
            if (p1Ready && p2Ready) {
                const name = playerNames[currentPlayer] || (currentPlayer === 0 ? "Player 1" : (selectedAI ? aiData[selectedAI].name : "Player 2"));
                statusMessage.textContent = `${name}'s Turn`;
            } else {
                statusMessage.textContent = missing.length > 0 ? `Waiting for: ${missing.join(', ')}` : "Ready to play!";
            }
        }
	}

	// --- MODIFIED: handleCellClick to be async ---
	async function handleCellClick(event) { // <<< Made async
		const clickedCell = event.target.closest('.cell');
		if (!clickedCell) return;
		const clickedCellIndex = parseInt(clickedCell.getAttribute('data-index'));

		let p1Ready = playerImages[0] && (playerNames[0] && playerNames[0].trim() !== '');
		let setupComplete;
		if (gameMode === 'onePlayer') {
			setupComplete = p1Ready && selectedAI;
		} else {
			let p2Ready = playerImages[1] && (playerNames[1] && playerNames[1].trim() !== '');
			setupComplete = p1Ready && p2Ready;
		}

		if (!setupComplete) {
			statusMessage.textContent = "Please complete setup!";
			if (playerSetupContainer.classList.contains('collapsed')) toggleConfigButton.click();
			return;
		}

		if (boardState[clickedCellIndex] !== null || !gameActive) return;
		if (gameMode === 'onePlayer' && currentPlayer === 1) return; // Human can't click for AI

		// Disable the specific cell immediately to prevent double clicks while async operations happen
		// clickedCell.style.pointerEvents = 'none'; // Re-enabled globally by placeMark

		await placeMark(clickedCell, clickedCellIndex, currentPlayer); // <<< Await placeMark
		// checkResult() is now called at the end of placeMark
	}
	// --- END MODIFIED: handleCellClick ---

	// --- MODIFIED: placeMark function to be async and handle sound completion ---
	async function placeMark(cellElement, index, player) {
		// Disable further clicks on the board while sound plays / mark is placed
		// This is a simple way, could also add a class to game-board and style pointer-events: none
		cells.forEach(c => c.style.pointerEvents = 'none');

		let soundPromise = Promise.resolve(); // Resolves immediately if no sound

		const audioSrc = playerAudioURLs[player];
		if (audioSrc) {
			const moveSound = new Audio(audioSrc);
			soundPromise = new Promise((resolve, reject) => {
				moveSound.onended = resolve;
				moveSound.onerror = (e) => {
					console.error("Error playing move sound:", e);
					resolve(); // Resolve even on error so game doesn't hang
				};
				moveSound.play().catch(e => {
					console.error("Error initiating move sound play:", e);
					resolve(); // Resolve on play initiation error
				});
			});
		}

		// Place the mark visually
		boardState[index] = player;
		const img = document.createElement('img');
		img.src = playerImages[player];
		cellElement.innerHTML = '';
		cellElement.appendChild(img);

		// Wait for the sound to finish (if any)
		await soundPromise;

		// Re-enable clicks on the board
		if (gameActive) { // Only re-enable if game is still active (not ended by this move)
		   cells.forEach(c => c.style.pointerEvents = 'auto');
		}


		checkResult(); // Now call checkResult after sound and visual update
	}
	// --- END MODIFIED: placeMark ---
	
    function speakText(textToSpeak, onEndCallback) { /* ... (full function from previous script) ... */
        if (!synth) {
            if (onEndCallback) onEndCallback(); return;
        }
        synth.cancel(); const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.pitch = 1.2; utterance.rate = 1;
        utterance.onend = () => { if (onEndCallback) onEndCallback(); };
        utterance.onerror = (e) => { console.error("Speech error:", e.error); if (onEndCallback) onEndCallback(); };
        synth.speak(utterance);
    }
	function playWinSound(playerIndex, winningPlayerName) { /* ... (full function from previous script, calls speakText with winningPlayerName) ... */
        let customSoundPlayed = false;
        function playComputerVoice() { speakText(`${winningPlayerName} wins`); } // No callback needed for game reset from here
        if (playerAudioURLs[playerIndex]) {
            let playCount = 0; const maxPlays = 3;
            function playNextInstance() {
                if (playCount >= maxPlays || gameActive) {
                    if (!customSoundPlayed && !gameActive) playComputerVoice(); return;
                }
                const audio = new Audio(playerAudioURLs[playerIndex]); audio.playbackRate = 3.0;
                audio.onended = () => { playCount++; customSoundPlayed = true; if (playCount >= maxPlays) playComputerVoice(); else playNextInstance(); };
                audio.onerror = (e) => { console.error(`Win sound error (inst ${playCount + 1}):`, e); playCount++; if (playCount >= maxPlays) playComputerVoice(); else playNextInstance(); };
                audio.play().catch(e => { console.error(`Win sound play error (inst ${playCount + 1}):`, e); playCount++; if (playCount >= maxPlays) playComputerVoice(); else playNextInstance(); });
            }
            playNextInstance();
        } else { playComputerVoice(); }
    }
	function showEndGameAnimation(displayText, isWinAnimation) { /* ... (full function from previous script) ... */
        winTextElement.textContent = displayText; winMessageOverlay.style.display = 'flex';
        winMessageOverlay.classList.add('visible'); winTextElement.style.animation = 'none';
        void winTextElement.offsetWidth; winTextElement.style.animation = 'fireworks-text-animation 5s forwards';
        statusMessage.textContent = "";
        if (winAnimationTimeout) clearTimeout(winAnimationTimeout);
        const visualTime = 5000;
        winAnimationTimeout = setTimeout(() => {
            winMessageOverlay.style.display = 'none'; winMessageOverlay.classList.remove('visible');
            if (!gameActive) resetGame();
        }, visualTime);
    }

	// --- START AI Helper Functions ---
	function findWinningMove(board, player) {
		for (let i = 0; i < board.length; i++) {
			if (board[i] === null) { // If cell is empty
				board[i] = player;    // Try placing player's mark
				if (checkWinCondition(board, player)) {
					board[i] = null;  // Reset board state
					return i;         // Return index of winning move
				}
				board[i] = null;      // Reset board state
			}
		}
		return -1; // No winning move found
	}

	function checkWinCondition(board, player) { // Slightly different from main checkResult, focused on a specific player
		for (const condition of winningConditions) {
			if (condition.every(index => board[index] === player)) {
				return true;
			}
		}
		return false;
	}

	function getAvailableCornerMoves(board) {
		const corners = [0, 2, 6, 8];
		return corners.filter(index => board[index] === null);
	}

	function getAvailableSideMoves(board) {
		const sides = [1, 3, 5, 7];
		return sides.filter(index => board[index] === null);
	}
	// --- END AI Helper Functions ---

	// --- START Minimax AI Functions (for Brainy Brian) ---
	function evaluateBoard(board) {
		// Check rows for win/loss
		for (let row = 0; row < 3; row++) {
			if (board[row*3] === board[row*3 + 1] && board[row*3 + 1] === board[row*3 + 2]) {
				if (board[row*3] === 1) return 10; // AI (player 1) wins
				if (board[row*3] === 0) return -10; // Human (player 0) wins
			}
		}
		// Check columns
		for (let col = 0; col < 3; col++) {
			if (board[col] === board[col + 3] && board[col + 3] === board[col + 6]) {
				if (board[col] === 1) return 10;
				if (board[col] === 0) return -10;
			}
		}
		// Check diagonals
		if (board[0] === board[4] && board[4] === board[8]) {
			if (board[0] === 1) return 10;
			if (board[0] === 0) return -10;
		}
		if (board[2] === board[4] && board[4] === board[6]) {
			if (board[2] === 1) return 10;
			if (board[2] === 0) return -10;
		}
		// No winner
		return 0;
	}

	function isMovesLeft(board) {
		return board.includes(null);
	}

	function minimax(currentBoard, player, depth = 0, alpha = -Infinity, beta = Infinity) { // Added alpha-beta pruning
		let score = evaluateBoard(currentBoard);

		// If AI wins, return score
		if (score === 10) return { score: score - depth }; // Prioritize faster wins
		// If Human wins, return score
		if (score === -10) return { score: score + depth }; // Prioritize delaying losses
		// If no moves left (draw)
		if (!isMovesLeft(currentBoard)) return { score: 0 };

		let moves = [];

		if (player === 1) { // AI's turn (maximizer)
			let bestScore = -Infinity;
			for (let i = 0; i < 9; i++) {
				if (currentBoard[i] === null) {
					currentBoard[i] = player;
					let moveScore = minimax(currentBoard, 0, depth + 1, alpha, beta).score; // Human's turn
					currentBoard[i] = null; // Undo move
					
					if (moveScore > bestScore) {
						bestScore = moveScore;
					}
					alpha = Math.max(alpha, bestScore);
					if (beta <= alpha) break; // Alpha-beta pruning

					moves.push({ index: i, score: moveScore });
				}
			}
			// Find the best move for the AI from the collected moves
			let bestMoveForAI;
			if (depth === 0) { // Only at the root call, pick one of the best moves
				 bestMoveForAI = moves.reduce((best, current) => (current.score > best.score ? current : best), {score: -Infinity});
			}
			return bestMoveForAI || { score: bestScore }; // Return best move object at root, or just score for recursion

		} else { // Human's turn (minimizer)
			let bestScore = Infinity;
			for (let i = 0; i < 9; i++) {
				if (currentBoard[i] === null) {
					currentBoard[i] = player;
					let moveScore = minimax(currentBoard, 1, depth + 1, alpha, beta).score; // AI's turn
					currentBoard[i] = null; // Undo move

					if (moveScore < bestScore) {
						bestScore = moveScore;
					}
					beta = Math.min(beta, bestScore);
					if (beta <= alpha) break; // Alpha-beta pruning
					
					// No need to store individual moves for the minimizer during recursion, just the score
				}
			}
			return { score: bestScore };
		}
	}
	// --- END Minimax AI Functions ---
	
	// --- Complete computerMove function with async sound handling and AI logic ---
	async function computerMove() {
		if (gameMode !== 'onePlayer' || currentPlayer !== 1 || !gameActive || !selectedAI) {
			return; // Not AI's turn or game not suitable for AI move
		}

		const currentAIName = playerNames[1] || "Computer";
		statusMessage.textContent = `${currentAIName} is thinking...`;

		// Disable all cell clicks while AI "thinks" and its sound potentially plays.
		// placeMark will re-enable them if the game is still active after the move.
		cells.forEach(c => c.style.pointerEvents = 'none');

		// Simulate thinking time - make it awaitable
		await new Promise(resolve => setTimeout(resolve, 750 + Math.random() * 500));

		let availableCells = [];
		boardState.forEach((cell, index) => {
			if (cell === null) {
				availableCells.push(index);
			}
		});

		if (availableCells.length === 0) {
			console.log("AI: No moves available (board full).");
			// If somehow reached here and game is still active, re-enable clicks.
			// checkResult should ideally handle this before AI's turn.
			if (gameActive) cells.forEach(c => c.style.pointerEvents = 'auto');
			return;
		}

		let chosenCellIndex = -1;
		const aiDifficulty = aiData[selectedAI].level;
		const humanPlayer = 0;
		const aiPlayer = 1;

		if (aiDifficulty === 'easy') { // Simple Simon: Random move
			chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
			console.log("SS: Chose random " + chosenCellIndex);
		} else if (aiDifficulty === 'medium') { // Average Joe
			console.log("Average Joe is thinking...");
			let winMove = findWinningMove(boardState, aiPlayer);
			if (winMove !== -1) {
				chosenCellIndex = winMove;
				console.log("AJ: Found winning move at " + chosenCellIndex);
			} else {
				let blockMove = findWinningMove(boardState, humanPlayer);
				if (blockMove !== -1) {
					chosenCellIndex = blockMove;
					console.log("AJ: Found blocking move at " + chosenCellIndex);
				} else {
					if (boardState[4] === null) { // Try center
						chosenCellIndex = 4;
						console.log("AJ: Taking center.");
					} else {
						let cornerMoves = getAvailableCornerMoves(boardState);
						if (cornerMoves.length > 0) { // Try a corner
							chosenCellIndex = cornerMoves[Math.floor(Math.random() * cornerMoves.length)];
							console.log("AJ: Taking random corner " + chosenCellIndex);
						} else {
							let sideMoves = getAvailableSideMoves(boardState);
							if (sideMoves.length > 0) { // Try a side
								chosenCellIndex = sideMoves[Math.floor(Math.random() * sideMoves.length)];
								console.log("AJ: Taking random side " + chosenCellIndex);
							}
						}
					}
				}
			}
			// Fallback for Average Joe if no strategic move found
			if (chosenCellIndex === -1 && availableCells.length > 0) {
				console.log("AJ: Fallback to random available cell.");
				chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
			}

		} else if (aiDifficulty === 'hard') { // Brainy Brian (Minimax)
			console.log("Brainy Brian is thinking (Minimax)...");

			if (willBrainFartThisGame && aiMovesMadeThisBrainFartGame < 1 && availableCells.length > 1) {
				console.log("BB: Brain Fart! Making a sub-optimal (random) move for this game's first AI turn.");
				chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
			} else {
				let bestMoveData = minimax(boardState, aiPlayer);
				if (bestMoveData && bestMoveData.index !== undefined && bestMoveData.index !== null && boardState[bestMoveData.index] === null) {
					 chosenCellIndex = bestMoveData.index;
					 console.log("BB: Minimax chose " + chosenCellIndex + " with score " + bestMoveData.score);
				} else {
					console.error("BB: Minimax failed or returned invalid/occupied move. BestMoveData:", bestMoveData, "Falling back to random.");
					if (availableCells.length > 0) {
						chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
					} else {
						chosenCellIndex = -1; // Should not happen if availableCells.length > 0 check at start passed
					}
				}
			}
			// Increment AI moves counter for this game if it was flagged as a brain fart game
			if (willBrainFartThisGame) {
				aiMovesMadeThisBrainFartGame++;
			}

		} else { // Default/Unknown difficulty
			console.warn("Unknown AI difficulty, defaulting to random move.");
			chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
		}

		// --- Execute the chosen move ---
		if (chosenCellIndex !== -1 && boardState[chosenCellIndex] === null) {
			const chosenCellElement = cells[chosenCellIndex];
			await placeMark(chosenCellElement, chosenCellIndex, aiPlayer); // AI is player index 1
		} else if (availableCells.length > 0 && chosenCellIndex === -1) {
			// Safety net if AI logic somehow didn't pick (should be rare with fallbacks in each AI type)
			console.warn("AI logic failed to determine a specific move, choosing random as a last resort.");
			chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
			const chosenCellElement = cells[chosenCellIndex];
			await placeMark(chosenCellElement, chosenCellIndex, aiPlayer);
		} else if (chosenCellIndex !== -1 && boardState[chosenCellIndex] !== null) {
			// AI logic bug: tried to pick an occupied cell.
			console.error(`AI ERROR: Attempted to move to occupied cell ${chosenCellIndex}. Falling back to random.`);
			if (availableCells.length > 0) {
				 chosenCellIndex = availableCells[Math.floor(Math.random() * availableCells.length)];
				 const chosenCellElement = cells[chosenCellIndex];
				 await placeMark(chosenCellElement, chosenCellIndex, aiPlayer);
			} else {
				console.log("AI: No moves left after error.");
				// If game is still active after this error and no moves left, re-enable clicks for human.
				if(gameActive) cells.forEach(c => c.style.pointerEvents = 'auto');
			}
		} else if (availableCells.length === 0) {
			// This state should ideally be caught by checkResult (draw) before AI tries to move.
			console.log("AI: No available cells (board full - re-checked in computerMove).");
			if(gameActive) cells.forEach(c => c.style.pointerEvents = 'auto');
		}
		// Note: Re-enabling of cell clicks is now primarily handled within placeMark's logic
		// after the sound has played and only if the game is still active.
	}
	// --- END computerMove function ---
	
	function checkResult() {
        let roundWon = false; let winningPlayer = -1;
        for (let i = 0; i < winningConditions.length; i++) {
            const win = winningConditions[i];
            if (boardState[win[0]] !== null && boardState[win[0]] === boardState[win[1]] && boardState[win[0]] === boardState[win[2]]) {
                roundWon = true; winningPlayer = boardState[win[0]]; break;
            }
        }
        if (roundWon) {
            gameActive = false; const winnerName = playerNames[winningPlayer];
            playWinSound(winningPlayer, winnerName);
            if (winningPlayer === 0) scorePlayer1++; else scorePlayer2++;
            updateScoreboardDisplay(); startingPlayerForNextGame = startingPlayerForNextGame === 0 ? 1 : 0;
            showEndGameAnimation(`${winnerName} Wins!`, true); return;
        }
        if (!boardState.includes(null) && gameActive) {
            gameActive = false; startingPlayerForNextGame = startingPlayerForNextGame === 0 ? 1 : 0;
            const drawSpeech = `It's a draw. Well done ${playerNames[0]} and ${playerNames[1]}`;
            speakText(drawSpeech); showEndGameAnimation("It's a Draw!", false); return;
        }
        if (gameActive) {
            switchPlayer();
            if (gameMode === 'onePlayer' && currentPlayer === 1 && gameActive) {
                computerMove();
            }
        }
	}

	function switchPlayer() {
		currentPlayer = currentPlayer === 0 ? 1 : 0;
        const name = playerNames[currentPlayer] || (currentPlayer === 0 ? "Player 1" : (selectedAI ? aiData[selectedAI].name : "Player 2"));
		statusMessage.textContent = `${name}'s Turn`;
	}

    function resetGameLogicOnly() {
        if (winAnimationTimeout) clearTimeout(winAnimationTimeout);
        winMessageOverlay.style.display = 'none'; winMessageOverlay.classList.remove('visible');
        winTextElement.style.animation = '';
        boardState.fill(null); gameActive = true;
        // startingPlayerForNextGame is set before calling this usually
        currentPlayer = startingPlayerForNextGame;
        cells.forEach(cell => cell.innerHTML = '');
    }

	// --- MODIFIED: resetGame function ---
	function resetGame() {
		if (winAnimationTimeout) clearTimeout(winAnimationTimeout);
		winMessageOverlay.style.display = 'none';
		winMessageOverlay.classList.remove('visible');
		winTextElement.style.animation = '';

		boardState.fill(null);
		gameActive = true;
		currentPlayer = startingPlayerForNextGame;
		cells.forEach(cell => cell.innerHTML = '');

		playerNames[0] = playerNameInputs[0].value.trim() || "Player 1";
		if (gameMode === 'onePlayer') {
			if (selectedAI) {
				playerNames[1] = aiData[selectedAI].name;
				playerImages[1] = aiData[selectedAI].image;
				playerAudioURLs[1] = aiData[selectedAI].sound;
				previewImages[1].src = aiData[selectedAI].image;
				previewImages[1].style.display = 'block';

				// --- ADD BRAIN FART DECISION FOR BRAINY BRIAN ---
				if (selectedAI === 'brainy-brian') {
					const brainFartChanceThisGame = 0.25; // 25% chance this game will have one mistake
					willBrainFartThisGame = Math.random() < brainFartChanceThisGame;
					aiMovesMadeThisBrainFartGame = 0; // Reset counter for this game
					if (willBrainFartThisGame) {
						console.log("BB: This game might have a brain fart!");
					}
				} else {
					willBrainFartThisGame = false; // Ensure it's false for other AIs
				}
				// --- END ADD ---

			} else {
				playerNames[1] = "Computer";
				playerImages[1] = null;
				playerAudioURLs[1] = null;
				previewImages[1].src = "#";
				previewImages[1].style.display = 'none';
				willBrainFartThisGame = false; // No brain fart if no AI selected
			}
		} else { // twoPlayer mode
			playerNames[1] = playerNameInputs[1].value.trim() || "Player 2";
			willBrainFartThisGame = false; // No brain fart in two-player mode
		}
		updateScoreboardDisplay();
		updateGameReadyStatus();

		if (gameMode === 'onePlayer' && currentPlayer === 1 && gameActive) {
			computerMove();
		}
	}
	// --- END MODIFIED: resetGame function ---

    // --- Event Listeners & Initial Setup ---
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    resetButton.addEventListener('click', resetGame);
    stopRecordButtons.forEach(btn => btn.disabled = true);
    previewImages.forEach(img => {
        if (img.src.endsWith("#") || !img.getAttribute('src')) {
            img.src = ""; img.style.display = 'none';
        }
    });
    setGameMode('twoPlayer');
});