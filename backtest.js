const request = require('request');
const unzip = require('unzipper');
const fs = require('file-system');

const years = [];
const percentLog = [];

function splitLine(line) {
  const linePattern = new RegExp('(\\d|\\(\\d\\d\\)|x)', 'g');
  const doubleDigitPattern = new RegExp('\\(\\d\\d\\)');
  const xPattern = new RegExp('x');
  const lineMatch = line.match(linePattern);
  return lineMatch ? lineMatch.map(scoreStr => {
    if (scoreStr.match(doubleDigitPattern)) {
      return +(scoreStr.replace(/[()]/g, ''));
    }
    if (scoreStr.match(xPattern)) {
      return 0;
    }
    return +scoreStr;
  }) : [];
}

function getScore(splitLine) {
  return splitLine.reduce((tot, score) => {
    return tot + score;
  }, 0);
}

function getTotalWins(currDate, side, currgameArr, games) {
  const visGames = getAllGamesForTeam(currDate, currgameArr[3], games);
  const homeGames = getAllGamesForTeam(currDate, currgameArr[6], games);

  return (side === 'visitor' ? visGames : homeGames).reduce((wins, cur) => {
    const currarr = cur.split(',');
    const visLine = splitLine(currarr[19]);
    const homeLine = splitLine(currarr[20]);
    if (getScore(side === 'visitor'? visLine : homeLine) > getScore(side === 'visitor' ? homeLine : visLine)) {
      return wins + 1;
    }
    return wins;
  }, 0);
}

function isNewer(date1, date2) {
  const date1Split = date1.split('');
  const date2Split = date2.split('');
  for (let i=0; i<date1Split.length; i++) {
    if (date1Split[i] > date2Split[i]) {
      return true;
    }
  }
  return false;
}

function getAllGamesForTeam(currDate, team, games) {
  return games.filter(game => {
    const gameArr = game.split(',');
    return !isNewer(gameArr[0], currDate) && (gameArr[3] === team || gameArr[6] === team);
  })
}

for (let i = +process.argv[2]; i<= +process.argv[3]; i++) {
  years.push(i);
}
for (const year of years) {
const writeStream = fs.createWriteStream('file');
let outstring = '';
const processGames = () => {
  let correctcount = 0;
  let opportunities = 0;
  const games = outstring.split('\n').filter(game => game);

  const randomSample = [];
  for (let g=0; g<100; g++) {
    const rand = Math.floor(Math.random() * games.length);
    randomSample.push(games[rand]);
  }

  randomSample.forEach(game => {
    const gamearr = game.split(',');
    const visline = splitLine(gamearr[19]);
    const homeline = splitLine(gamearr[20]);

    const visWins = getTotalWins(gamearr[0], 'visitor', gamearr, games);
    const homeWins = getTotalWins(gamearr[0], 'home', gamearr, games);

    const scoreline = [];
    let j = 0;
    for (let i=0; i<visline.length*2; i++) {
      if (i % 2 === 0) {
        scoreline.push(+visline[j] || 0);
      } else {
        scoreline.push(+homeline[j] || 0);
        j++;
      }
    }

    const actual = scoreline.reduce((acc, score, i) => {
      const key = i % 2 === 0 ? 'vis' : 'home';
      return {
        ...acc,
        [key]: acc[key] + score
      }
    }, {home: 0, vis: 0});

    let predictor = null;

    for (let i=0; i<scoreline.length; i=i+2) {
      if (i >= +process.argv[4]) break;
      const inning = {vis: scoreline[i], hom: scoreline[i+1]};
      if (inning.vis && !inning.hom) {
        visWins > homeWins && (predictor = 'visitor');
        break;
      } else if (inning.hom && !inning.vis) {
        homeWins > visWins && (predictor = 'home');
        break;
      }
    };
    
    if (actual.home > actual.vis && predictor === 'home') {
      console.log(visline.join(' '));
      console.log(homeline.join(' '));
      console.log('=========================');
      correctcount++;
    } else if (actual.vis > actual.home && predictor === 'visitor') {
      console.log(visline.join(' '));
      console.log(homeline.join(' '));
      console.log('=========================');
      correctcount++;
    }

    if (predictor) { opportunities++; }
    
  });

  const percent = correctcount / opportunities;
  percentLog.push(percent);

  console.log(percent);

  // console.log('GAMES:', games.length);
  // console.log('OPPORTUNITIES:', opportunities);
  // console.log('CORRECTS:', correctcount);
  // console.log('YEAR:', year, '% PREDICTIVE:', percent);
  // console.log('=====================================================================================');
}

request.get(`https://www.retrosheet.org/gamelogs/gl${year}.zip`)
  .pipe(unzip.Parse())
  .on('entry', entry => {
    entry
      .on('data', (data) => {
        const rawdata = data.toString('ascii');
        outstring += rawdata;
      })
      .on('end', processGames);
    entry.pipe(writeStream)
  });

}
