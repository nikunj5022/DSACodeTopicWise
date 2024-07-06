import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';
import { onValueUpdated } from 'firebase-functions/v2/database';
import { logger } from 'firebase-functions';

initializeApp();
const db = getDatabase();

export const startGame = onValueUpdated('/matchMaking', async (event) => {
  const matchMakingRef = db.ref('/matchMaking');
  const lockRef = db.ref('/lock');

  try {
    const lockResult = await lockRef.transaction(lock => {
      if (!lock) {
        return true;
      }
      return;
    });

    if (!lockResult.committed) {
      logger.info('Lock already acquired by another instance');
      return;
    }

    const snapshot = await matchMakingRef.once('value');
    const matchMaking = snapshot.val();
    const matchMakingKeys = Object.keys(matchMaking || {});

    if (matchMakingKeys.length >= 2) {
      let player1: any;
      let player2: any;

      for (let i = 0; i < matchMakingKeys.length; i++) {
        const player = matchMaking[matchMakingKeys[i]];
        if (!player1 && !player.gameId) {
          player1 = player;
          player1.id = matchMakingKeys[i];
        } else if (!player2 && !player.gameId) {
          player2 = player;
          player2.id = matchMakingKeys[i];
        }
        if (player1 && player2) {
          break;
        }
      }

      if (player1 && player2) {
        const firstPlayerId = player1.id;
        const secondPlayerId = player2.id;
        const firstPlayerInfo = {
          userName: player1.info.userName,
          photoUrl: player1.info.photoUrl,
          score: 0,
        };
        const secondPlayerInfo = {
          userName: player2.info.userName,
          photoUrl: player2.info.photoUrl,
          score: 0,
        };

        const playerKeyValue = {
          [firstPlayerId]: firstPlayerInfo,
          [secondPlayerId]: secondPlayerInfo
        };

        const gameId = ${firstPlayerId}_${secondPlayerId};
        const inGameRef = db.ref(/inGame/${gameId});

        const equations = generateEquations();

        await inGameRef.set({
          players: playerKeyValue,
          questionOptions: equations
        });

        const updates = {
          [/matchMaking/${firstPlayerId}]: { gameId, opponentUuid: secondPlayerId },
          [/matchMaking/${secondPlayerId}]: { gameId, opponentUuid: firstPlayerId }
        };

        await db.ref().update(updates);
      }
    }
  } catch (error) {
    logger.error('Error processing matchmaking:', error);
  } finally {
    await lockRef.set(false);
  }
});

function generateEquations() {
  const equations = [];
  for (let i = 1; i <= 30; i++) {
    const num1 = Math.floor(Math.random() * (i > 10 ? 100 : 10));
    const num2 = Math.floor(Math.random() * (i > 10 ? 100 : 10));
    const operators = ["+", "-", "*"];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    const result = eval(${num1} ${operator} ${num2});
    const options = generateOptions(result);

    equations.push({ numbers: [num1, num2], options, operator, correctAns: result });
  }
  return equations;
}

function generateOptions(correctAnswer) {
  const options = [correctAnswer];
  while (options.length < 4) {
    const wrongOption = correctAnswer + (Math.floor(Math.random() * 5) - Math.floor(Math.random() * 5));
    if (!options.includes(wrongOption)) options.push(wrongOption);
  }
  return options.sort(() => Math.random() - 0.5);
}
