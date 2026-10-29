// priority: 0
// ============================================================
// More Up: 게임 규칙 고정 (자연 회복, Artifacts 효과 수치)
// 경로: kubejs/server_scripts/systems/gamerules.js
//
// 새로 만든 월드(서버·개인 월드 모두)에서 naturalRegeneration 이 false 로 시작했다 (2026-10-24 level.dat 확인).
// 사용자 결정으로 자연 회복을 켠다. 서버가 켜질 때마다 다시 적용한다.
// 2026-10-26 확인: 진짜 원인은 Rough Tweaks Revamped 가 플레이어 접속 때마다 이 규칙을 config/roughtweaks.toml 의
// healthRegen 값으로 덮어쓰는 것이었다 → healthRegen = true 로 바꿨다. 이 값을 다시 false 로 두면 이 스크립트로는 못 막는다.
// Tough As Nails 의 "목마르면 회복 안 됨"(config/toughasnails/thirst.toml thirst_prevent_health_regen)도 false 로 껐다.
// ============================================================

// Artifacts 모드 효과 소폭 상향 (2026-10-27 사용자 요청: 아티팩트 효과 소폭 증가). Artifacts 9.x 는 효과 수치를 게임 규칙으로 둔다.
// 효과 세기만 약 +20% (기본값 → 새 값). 쿨다운·효과 레벨(점프·속도 단계)·외형 관련 규칙은 그대로.
// 실수형 규칙은 정수로 저장된다 (예: 40 = 40%, 디깅 클로 32 = 3.2배). 기본값은 artifacts-forge-9.5.19 jar 의 ModGameRules 에서 확인
const MOREUP_ARTIFACTS_RULES = {
    'artifacts.powerGlove.attackDamageBonus': '5',               // 4
    'artifacts.crystalHeart.healthBonus': '12',                  // 10
    'artifacts.feralClaws.attackSpeedBonus': '48',               // 40
    'artifacts.runningShoes.speedBonus': '48',                   // 40
    'artifacts.flippers.swimSpeedBonus': '120',                  // 100
    'artifacts.vampiricGlove.absorptionRatio': '24',             // 20
    'artifacts.vampiricGlove.maxHealingPerHit': '7',             // 6
    'artifacts.thornPendant.maxDamage': '7',                     // 6
    'artifacts.thornPendant.strikeChance': '60',                 // 50
    'artifacts.flamePendant.strikeChance': '48',                 // 40
    'artifacts.flamePendant.fireDuration': '12',                 // 10
    'artifacts.shockPendant.strikeChance': '30',                 // 25
    'artifacts.fireGauntlet.fireDuration': '10',                 // 8
    'artifacts.crossNecklace.bonusInvincibilityTicks': '24',     // 20
    'artifacts.chorusTotem.healthRestored': '12',                // 10
    'artifacts.goldenHook.experienceBonus': '90',                // 75
    'artifacts.diggingClaws.digSpeedBonus': '38',                // 32
    'artifacts.pocketPiston.knockbackStrength': '18',            // 15
    'artifacts.heliumFlamingo.flightDuration': '10',             // 8
    'artifacts.obsidianSkull.fireResistanceDuration': '36',      // 30
    'artifacts.panicNecklace.speedDuration': '10',               // 8
    'artifacts.snorkel.waterBreathingDuration': '18',            // 15
    'artifacts.onionRing.hasteDurationPerFoodPoint': '7',        // 6
    'artifacts.rootedBoots.hungerReplenishingDuration': '18',    // 15
    'artifacts.cloudInABottle.sprintJumpHorizontalVelocity': '55' // 50 (방향 조작이 어색해지지 않게 10%만)
}

const MOREUP_GAMERULES = {
    naturalRegeneration: 'true',
    // 2026-10-29 (1.5.4 편의성): 접속자의 30%만 자도 밤이 넘어간다 (바닐라 기본 100%). 10명이면 3명, 1~3명이면 1명
    // 잠자기를 따로 바꾸는 모드는 없다 (서버 config 에서 확인)
    playersSleepingPercentage: '30'
}
for (let rule in MOREUP_ARTIFACTS_RULES) MOREUP_GAMERULES[rule] = MOREUP_ARTIFACTS_RULES[rule]

ServerEvents.loaded(event => {
    let failed = []
    for (let rule in MOREUP_GAMERULES) {
        try {
            // 설정에 성공하면 새 값(정수 규칙) 또는 1(참 규칙)을 돌려준다. 없는 규칙 이름이면 0
            if (event.server.runCommandSilent(`gamerule ${rule} ${MOREUP_GAMERULES[rule]}`) === 0) failed.push(rule)
        } catch (e) {
            console.error(`[MoreUp] 게임 규칙 ${rule} 적용 실패: ${e}`)
        }
    }
    if (failed.length > 0) console.warn(`[MoreUp] 적용되지 않은 게임 규칙 (이름 확인 필요): ${failed.join(', ')}`)
    console.info(`[MoreUp] 게임 규칙 적용: ${Object.keys(MOREUP_GAMERULES).map(k => k + '=' + MOREUP_GAMERULES[k]).join(', ')}`)
})
