'use strict';
// Balance Lab target ranges (DD H4). A result outside its range shows red in lab.html.
// Change a target only by agreement: a red result is reported, never hidden by retuning numbers.
// `gate` names the patch whose "done when" list requires the target to be green.
const BALANCE_TARGETS = {
  mgPin: { label: '1 MG pins a Rifleman', unit: 's', min: 3.5, max: 5.5, gate: '0.2.1' },
  heightDuel: { label: '5 v 5 Riflemen, side with +30 m height wins', unit: '%', min: 65, max: 80, gate: '0.2.1' },
  squadVsLoose: { label: '6 Riflemen in a squadron beat 6 loose Riflemen', unit: '%', min: 55, max: 60, gate: '0.3.1' },
  // Kaan, 0.5a.1: lowered from 6–10 min together with a slower economy (pace 0.7, 20 starting metal).
  firstTier2: { label: 'First Tier II research affordable', unit: 'min', min: 1, max: 3, gate: '0.5' },
  // Waits for the AI to play by the player's economy (DD Q23, DD L): two identical scripted AIs stall.
  aiMatchLength: { label: 'AI vs AI match length', unit: 'min', min: 45, max: 75, gate: 'Later (AI economy, Q23)' },
};
