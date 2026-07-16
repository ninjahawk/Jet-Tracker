/* ============================================================
   JETTRACK — static intel data
   G700 registry sweep compiled by r/ElonJetTracker from the
   rzjets / FAA Aircraft Registry lookup (see sub sidebar).
   ============================================================ */

const TARGET = {
  reg: "N628TS",
  icao: "a835af",
  type: "Gulfstream G650ER",
  typeCode: "GLF6",
};

/* reg, notes, modeS, serial, operator/contract, built, airworthy, flagged */
const G700_WATCHLIST = [
  ["N700GA", "prototype",                 "A95525", "87001", "Gulfstream Aero.",  "2020", "2021/03/16", false],
  ["N702GD", "prototype",                 "A95C96", "87002", "Gulfstream Aero.",  "2020", "",           false],
  ["N703GA", "prototype",                 "A9604A", "87003", "Gulfstream Aero.",  "2020", "2022/04/14", false],
  ["N704GA", "prototype",                 "A96401", "87004", "Gulfstream Aero.",  "2020", "2022/03/11", false],
  ["N705GD", "Experimental",              "A967BB", "87005", "Gulfstream Aero.",  "2019", "2021/10/06", false],
  ["N706GD", "a/w 4/1/22. Demonstrator",  "A96B72", "87006", "Gulfstream Aero.",  "2021", "2022/04/01", false],
  ["N703GD", "Experimental",              "A9604D", "87007", "Gulfstream Aero.",  "2019", "2021/11/10", false],
  ["N708GA", "",                          "A972DD", "87008", "Gulfstream Aero.",  "2019", "",           false],
  ["N709GA", "",                          "A97694", "87009", "",                  "2021", "",           false],
  ["N710GA", "",                          "A97CA4", "87010", "",                  "2021", "",           false],
  ["N711GA", "Falcon Holdings LLC",       "A9805B", "87011", "Falcon Holdings LLC", "2021", "",         true],
  ["N112GA", "Falcon Holdings LLC",       "A03438", "87012", "Falcon Holdings LLC", "2021", "",         true],
  ["N870GA", "",                          "ABF6ED", "87013", "",                  "2022", "",           false],
  ["N714GA", "",                          "A98B80", "87014", "",                  "2022", "",           false],
  ["N715GA", "",                          "A98F37", "87015", "",                  "2022", "",           false],
  ["N716GA", "",                          "A992EE", "87016", "",                  "2022", "",           false],
  ["N171GA", "",                          "A11D7B", "87017", "",                  "2022", "",           false],
  ["N718GA", "",                          "A99A5C", "87018", "",                  "2022", "",           false],
  ["N719GD", "",                          "A99E16", "87019", "",                  "2022", "",           false],
  ["N720GS", "",                          "A9A433", "87020", "",                  "2022", "",           false],
  ["N721GD", "",                          "A9A7DD", "87021", "",                  "2022", "",           false],
  ["N122GA", "",                          "A05BB7", "87022", "",                  "2022", "",           false],
  ["N723GD", "",                          "A9AF4B", "87023", "",                  "2022", "",           false],
];

/* Points of interest rendered on the tactical map */
const POIS = [
  { name: "GIGA TEXAS",      lat: 30.2226, lon: -97.6171 },
  { name: "KAUS / AUSTIN",   lat: 30.1975, lon: -97.6664 },
  { name: "STARBASE",        lat: 25.9972, lon: -97.1560 },
  { name: "KBRO / BROWNSVILLE", lat: 25.9068, lon: -97.4259 },
  { name: "HAWTHORNE / SPACEX HQ", lat: 33.9207, lon: -118.3278 },
  { name: "KVNY / VAN NUYS", lat: 34.2098, lon: -118.4890 },
  { name: "KIAD / WASHINGTON", lat: 38.9445, lon: -77.4558 },
];

/* Simulated flight plan used when the live feed is filtered (LADD/PIA):
   Austin (Giga Texas) -> Brownsville (Starbase). */
const MOCK_ROUTE = {
  from: { name: "KAUS", lat: 30.1975, lon: -97.6664 },
  to:   { name: "KBRO", lat: 25.9068, lon: -97.4259 },
  cruiseAltFt: 43000,
  cruiseGsKt: 488,
  durationSec: 720, // sim loops a compressed 12-minute leg
};
