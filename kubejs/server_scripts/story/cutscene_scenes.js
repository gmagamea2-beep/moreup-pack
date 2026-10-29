// priority: 10
// ============================================================
// More Up: 메인 스토리 컷씬 대본 (2026-10-27)
// 경로: kubejs/server_scripts/story/cutscene_scenes.js
//
// 재생 엔진은 같은 폴더의 cutscene.js. 이 파일은 내용만 담는다 (코드 수정 없이 대사·소리를 바꿀 수 있게).
// 원문: 사용자 작성 「창세와 비상의 서사시」(퀘스트 보상 「별의 기록서」 I·II), 기존 연출 대사(kubejs/data/scene)
// 막과 퀘스트 챕터의 연결은 MoreUp/docs/story.md
//
// 장면(scene) 키
//   order   목록 순서          name    목록·채팅 기록에 쓰는 이름
//   accent  강조색 (RRGGBB)     delay   시작 전 대기 틱 (다른 연출과 겹치지 않게)
//   steps   차례로 재생할 단계
//
// 단계(step) 종류
//   { title, sub, hold }  화면 가운데 제목 카드. hold = 다 보인 뒤 머무는 틱
//   { text, color?, hold? } 아래 검은 띠에 한 글자씩 써지는 내레이션. hold 를 비우면 글자 수로 정한다
//   { pause }             아무것도 없이 쉬는 틱
//   공통 선택 키: sound: [소리 ID, 크기, 높낮이], particle: [파티클 ID, 개수], effect: [효과 ID, 초]
//             anim: 애니메이션 이름 (cutscene_anims.js 의 MOREUP_CS_ANIMS, 그 단계 동안 화면에 재생, 1.5.4)
//   장면 선택 키 ambient: 'stars' — 장면 내내 배경 별빛, titleAnim: false — 제목 카드 뒤 마법진 끄기
//   (소리·파티클·효과는 그 플레이어에게만 보인다)
// ============================================================

const MOREUP_SCENES = {
    act1: {
        order: 1, name: '제 1막 · 윤회의 시작', accent: '55FFFF', ambient: 'stars',
        steps: [
            { title: '제 1막', sub: '윤회의 시작', hold: 50, sound: ['minecraft:block.end_portal.spawn', 0.7, 0.5] },
            { text: '아주 먼 옛날, 우주에는 낮도 밤도 없었습니다. 오직 거대한 빛의 용 하나만이 공허를 유영했습니다.', color: 'FFF3B0', particle: ['minecraft:end_rod', 30], anim: 'breath' },
            { text: '그러나 완전함은 곧 정체였습니다. 성장을 멈춘 우주는 서서히 식어 갔습니다.', color: 'B0C4DE', anim: 'cooling' },
            // 폭발음은 애니메이션이 터지는 순간(shatter 의 cue)에 낸다
            { text: '용은 스스로를 부수어 다시 태어나기로 했습니다. 가장 찬란했던 빛이 산산조각 나 심연으로 떨어졌습니다.', particle: ['minecraft:firework', 40], anim: 'shatter' },
            { text: '어둠뿐인 공허 속에서, 일곱 개의 파편이 흩어졌습니다.', color: 'AAAAAA', anim: 'starfall' },
            { pause: 20 },
            { text: '그리고 지금, 일곱의 영혼이 진흙 속에서 눈을 뜹니다. 자신이 누구였는지조차 잊은 채로.', sound: ['minecraft:block.amethyst_block.chime', 1, 0.8], anim: 'awaken' },
            { text: '잊혀진 기억을 되찾고, 영원한 윤회의 닻을 내리십시오.', color: '55FFFF', sound: ['minecraft:block.beacon.activate', 0.6, 1.2] }
        ]
    },
    act2: {
        order: 2, name: '제 2막 · 강철의 태동', accent: 'FFAA00',
        steps: [
            { title: '제 2막', sub: '강철의 태동', hold: 50, sound: ['minecraft:block.anvil.use', 0.6, 0.6] },
            { text: '고대의 파수꾼이 침묵하고, 첫 번째 파편이 진동합니다.', particle: ['minecraft:enchant', 40], anim: 'tremor' },
            { text: '육신은 숱하게 찢기고 부서졌지만, 죽음은 끝이 아니었습니다. 부서질 때마다 영혼은 다시 일어섰습니다.', color: 'B0C4DE' },
            { text: '어떤 이는 강철의 뼈대와 톱니바퀴를 깎았고, 어떤 이는 허공에 흩어진 용의 숨결을 엮어 주문을 외웠습니다.', sound: ['minecraft:block.smithing_table.use', 0.7, 0.9], anim: 'gears' },
            { text: '또 어떤 이는 대지의 피와 살을 취해, 굶주린 육신을 한계 너머로 강화했습니다.' },
            { text: '나약한 육신을 벗어던지고, 강철로 심장을 벼려낼 때입니다.', color: 'FFAA00', sound: ['minecraft:block.beacon.power_select', 0.7, 1] }
        ]
    },
    act3: {
        order: 3, name: '제 3막 · 차원의 파편', accent: 'AA77FF',
        steps: [
            { title: '제 3막', sub: '차원의 파편', hold: 50, sound: ['minecraft:block.portal.trigger', 0.4, 1.2] },
            { text: '파괴의 화신은 무너졌고, 당신은 영원히 빛나는 별을 손에 쥐었습니다.', color: 'FFF3B0', particle: ['minecraft:end_rod', 30] },
            { text: '용의 육체와 권능은 황혼의 숲, 네더의 불길, 천상의 낙원, 끝없는 심연으로 흩어졌습니다.', particle: ['minecraft:reverse_portal', 60], anim: 'portal' },
            { text: '주인을 잃은 힘의 파편들은 차원의 포식자에게 깃들어, 파괴하고 군림하는 괴물이 되었습니다.', color: 'FF7777', sound: ['minecraft:entity.wither.ambient', 0.3, 0.6] },
            { text: '별의 궤적이 멎는 아스라한 성벽 너머, 당신의 조각을 품은 파수꾼의 덧없는 꿈을 흩어내십시오.', color: 'AA77FF', sound: ['minecraft:block.respawn_anchor.charge', 0.7, 0.8] }
        ]
    },
    act4: {
        order: 4, name: '제 4막 · 일곱 갈래의 톱니바퀴', accent: 'FF5555',
        steps: [
            { title: '제 4막', sub: '일곱 갈래의 톱니바퀴', hold: 50, sound: ['minecraft:item.trident.thunder', 0.4, 0.8] },
            { text: '별의 기록서가 진실을 밝혔습니다. 세상의 보스는 당신의 빛을 훔친 거짓된 왕들입니다.', color: 'FFF3B0' },
            { text: '재앙의 화신, 얼음과 불의 폭군, 황혼을 갉아먹는 그림자. 그들은 빛을 독점한 채 차원을 지배해 왔습니다.', color: 'FF7777', sound: ['minecraft:entity.ender_dragon.growl', 0.3, 0.7] },
            { text: '분업하고 연대하십시오. 적의 심장을 찢고 권능을 흡수할 때마다, 희미했던 전생의 기억이 돌아올 것입니다.', anim: 'arcana' },
            { text: '강철과 비전, 대지의 힘을 모아 그들의 목을 베고, 아홉 갈래로 흩어진 권능을 되찾으십시오.', color: 'FF5555', sound: ['minecraft:block.bell.resonate', 0.6, 1] }
        ]
    },
    act5: {
        order: 5, name: '제 5막 · 황혼의 끝, 빛의 포효', accent: 'AA00AA',
        steps: [
            { title: '제 5막', sub: '황혼의 끝, 빛의 포효', hold: 60, sound: ['minecraft:entity.elder_guardian.curse', 0.5, 0.6], effect: ['minecraft:darkness', 4] },
            { text: '모든 차원을 정복한 일곱은, 태양을 가려 버린 마지막 그림자와 마주했습니다.', color: 'B0C4DE', particle: ['minecraft:squid_ink', 30] },
            { text: '황혼의 군주. 용이 버리고자 했던 정체와 어둠이 응집된 흉물이 황혼의 숲 꼭대기에서 기다립니다.', color: 'DD66DD', sound: ['minecraft:entity.wither.ambient', 0.4, 0.5], anim: 'eclipse' },
            { text: '그동안 모아 온 모든 마법과 기계, 전설의 무기를 들고 최후의 성전에 나서십시오.', color: 'AA00AA', sound: ['minecraft:block.respawn_anchor.charge', 0.8, 0.6] }
        ]
    },
    act5_end: {
        // 모어 업 완성 순간: more_up_clear.js 의 서버 전체 타이틀(약 7초)이 끝난 뒤 시작한다
        order: 6, name: '종장 · 새로운 빛의 성룡', accent: 'FFD700', delay: 150, ambient: 'stars',
        steps: [
            { text: '기나긴 사투 끝에 황혼의 군주가 쓰러지고, 그 안에 갇혀 있던 태초의 빛이 폭발하듯 쏟아져 나왔습니다.', color: 'FFF3B0', sound: ['minecraft:entity.generic.explode', 0.4, 0.8], particle: ['minecraft:flash', 1] },
            { text: '그 빛은 일곱을 하나로 녹여 내지 않았습니다. 일곱 각자가 온전한 하나의 별이 되어 밤하늘로 떠올랐습니다.', particle: ['minecraft:end_rod', 60], anim: 'ascend' },
            { text: '일곱 개의 궤적이 하늘에서 얽히며, 태초의 용보다 훨씬 찬란한 새로운 빛의 성룡을 그려 냅니다.', color: 'FFD700', sound: ['minecraft:block.amethyst_block.chime', 1, 1.2], anim: 'constellation' },
            { text: '땀방울과 톱니바퀴, 피와 마법으로 벼려진 이 새로운 용은 과거보다 훨씬 완벽한 존재가 되었습니다.' },
            { text: '그렇게 우주는 정체를 끝내고 다시 팽창하기 시작합니다.', color: 'B0E0FF' },
            { pause: 20 },
            { title: 'MORE UP', sub: '끝이 아닌, 새로운 창세의 시작 · Remaster 0', hold: 80, sound: ['minecraft:ui.toast.challenge_complete', 1, 1], particle: ['minecraft:totem_of_undying', 80] }
        ]
    },
    act6: {
        order: 7, name: '에필로그 · 새로운 창세', accent: '55FF55',
        steps: [
            { title: '에필로그', sub: '새로운 창세', hold: 50, sound: ['minecraft:block.conduit.activate', 0.6, 1] },
            { text: '쓰러진 군주의 황혼이 조각으로 남았습니다. 이제 그 힘은 새로운 별의 것입니다.', color: 'DD66DD', particle: ['minecraft:end_rod', 30] },
            { text: '다시 팽창하는 우주 속에서, 황혼의 힘을 다스려 더 높이 오르십시오. 끝없이, 위로.', color: '55FF55', sound: ['minecraft:entity.player.levelup', 0.6, 0.8], anim: 'expand' }
        ]
    }
}
