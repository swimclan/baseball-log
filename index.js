const https = require('https');
const get = require('lodash/get');
const Clock = require('interval-clock');
const sgMail = require('@sendgrid/mail');
require('dotenv').config();

const bets = [];

const api_key = process.env.API_KEY;
const sendMail = (teamName, mailer, key) => {
  mailer.setApiKey(key);
  const msg = {
    to: process.env.TO_EMAIL,
    from: process.env.FROM_EMAIL,
    subject: 'There is an opportunity',
    text: `You need to bet on ${teamName}`,
    html: `<p>You need to bet on ${teamName}</p>`
  }
  mailer.send(msg);
};


/* Util functions */
// date format : "mm/dd/yyyy"
const scheduleUrl = (date) => `https://statsapi.mlb.com/api/v1/schedule?language=en&sportId=1&date=${date}`;
const liveDataUrl = (id) => `https://statsapi.mlb.com/api/v1.1/game/${id}/feed/live`;
const formatDate = (dateObj) => {
  const ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(dateObj)
  const mo = new Intl.DateTimeFormat('en', { month: '2-digit' }).format(dateObj)
  const da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(dateObj);
  return `${mo}/${da}/${ye}`;
  
}
const getScheduleDateData = url => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });
  
      response.on('end', () => {
        return resolve(JSON.parse(data));
      });

      response.on('error', (err) => {
        return reject(err.message || err);
      });
    });
  });
}

const getLiveLineScore = (url) => {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        return resolve(JSON.parse(data));
      });

      response.on('error', (err) => {
        return reject(err.message || err);
      });
    });
  });
}

/* Main program */ 
const clock = Clock('2m');
clock.on('tick', async () => {
  const todaysDate = new Date();
  const todaysScheduleUrl = scheduleUrl(formatDate(todaysDate));
  let schedule;
  try{
    schedule = await getScheduleDateData(todaysScheduleUrl);
  } catch (err) {
    console.log(err.message || err);
    return;
  }
  console.log('There are', schedule.dates[0].games.length, 'games today');

  for (const game of schedule.dates[0].games) {
    const awayTeamName = get(game, 'teams.away.team.name', '');
    const homeTeamName = get(game, 'teams.home.team.name', '');
    const gameStatus = get(game, 'status.abstractGameCode', null);
    const awayTeamWins = get(game, 'teams.away.leagueRecord.wins', 0);
    const homeTeamWins = get(game, 'teams.home.leagueRecord.wins', 0);
    if (gameStatus === 'L') {
      const {gamePk} = game;
      console.log('===================================================')
      console.log(awayTeamName, 'at', homeTeamName);
      let gameData;
      try {
        gameData = await getLiveLineScore(liveDataUrl(gamePk));
      } catch (e) {
        return;
      }
      const lineScore = get(gameData, 'liveData.linescore.innings', []);
      let curInning = 1;
      for (const inning of lineScore) {
        if (curInning > 3) { break; }
        const awayRuns = get(inning, 'away.runs', null);
        const homeRuns = get(inning, 'home.runs', null);
        console.log(awayRuns, 'to', homeRuns);
        if (bets.indexOf(gamePk) === -1 && awayRuns && homeRuns === 0 && awayTeamWins > homeTeamWins) {
          console.log('homeruns', homeRuns, 'visruns', awayRuns);
          console.log('homewins', homeTeamWins, 'viswins', awayTeamWins);
          console.log('Visitor will win, Bet on', awayTeamName);
          sendMail(awayTeamName, sgMail, api_key);
          bets.push(gamePk);
          break;
        }
        if (bets.indexOf(gamePk) === -1 && homeRuns && awayRuns === 0 && homeTeamWins > awayTeamWins) {
          console.log('homeruns', homeRuns, 'visruns', awayRuns);
          console.log('homewins', homeTeamWins, 'viswins', awayTeamWins);
          console.log('Home will win, Bet on', homeTeamName);
          sendMail(homeTeamName, sgMail, api_key);
          bets.push(gamePk);
          break;
        }
        if (bets.indexOf(gamePk) === -1 && (homeRuns && awayRuns === 0 || awayRuns && homeRuns === 0)) {
          bets.push(gamePk);
          break;
        }
        curInning++;
      }
    }
  };
});

