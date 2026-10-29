// priority: 0
// ============================================================
// More Up: 초보자 안내 (2026-10-29, 1.5.4 편의성)
// 경로: kubejs/server_scripts/systems/guide.js
//
// - 처음 접속하면 화면 제목 + 환영 안내 + 기본 물품(MOREUP_GUIDE_STARTER_KIT, 1.5.5), 처음 MOREUP_GUIDE_HINT_LOGINS 번 접속할 때까지는 "/가이드" 한 줄 알림
// - /가이드 [주제] (같은 명령: /guide) — 주제: 시작, 명령어, 키, 정수, 정예. 주제 이름은 눌러서 열 수 있다
// 키는 각 모드의 기본값만 적는다 (팩 options.txt 는 언어·리소스팩만 넣어 플레이어는 모드 기본 키를 쓴다).
// 바꾼 키는 설정 → 조작에서 검색(Controlling)으로 찾는다.
// 접속 기록은 서버 persistentData "moreupJoins.<UUID>" (플레이어 데이터는 죽으면 옮겨지지 않아 서버 쪽에 둔다)
// ============================================================

const MOREUP_GUIDE_HINT_LOGINS = 5
const MOREUP_GUIDE_JOIN_KEY = 'moreupJoins.'
// 1.5.5 처음 접속 기본 물품. 근거: 초반 사망 대부분이 좀비·스켈레톤(어려움 난이도), 물·체온(Tough As Nails) 준비가 늦어 성장이 막혔다.
// 처음 접속할 때 한 번만 준다 (접속 횟수 1). 1.5.4 이전부터 접속하던 플레이어는 이미 횟수가 있어 받지 않는다
const MOREUP_GUIDE_STARTER_KIT = [
    ['minecraft:stone_sword', 1], ['minecraft:stone_pickaxe', 1], ['minecraft:stone_axe', 1], ['minecraft:stone_shovel', 1],
    ['minecraft:shield', 1],
    ['minecraft:leather_helmet', 1], ['minecraft:leather_chestplate', 1], ['minecraft:leather_leggings', 1], ['minecraft:leather_boots', 1],
    ['minecraft:bread', 16], ['minecraft:torch', 32],
    ['toughasnails:purified_water_bottle', 4], ['toughasnails:empty_leather_canteen', 1],
    ['waystones:return_scroll', 2]
]

// 각 줄: [강조(노랑), 설명(흰색)]
const MOREUP_GUIDE_TOPICS = {
    '시작': {
        title: '처음 시작하기',
        lines: [
            ['퀘스트북', '인벤토리(E) 왼쪽 위 아이콘 중 책 — "메인 스토리" 를 따라가면 막막하지 않아요'],
            ['조합법', '아이템에 마우스를 올리고 R(만드는 법) / U(쓰이는 곳). 오른쪽 목록에서 검색'],
            ['지도', 'J 큰 지도(JourneyMap), M 땅 차지 지도(FTB Chunks) — 지도에서 드래그하면 내 땅이 보호돼요'],
            ['죽으면', '그 자리에 무덤이 생기고 물건이 들어 있어요. /back 으로 바로 돌아갈 수 있어요'],
            ['이동', '/sethome 으로 집 저장, /home 으로 귀환. 웨이스톤(돌 기둥)을 찾으면 순간 이동 지점이 돼요'],
            ['잠', '접속자 30%만 자도 밤이 넘어가요']
        ]
    },
    '명령어': {
        title: '자주 쓰는 명령어',
        lines: [
            ['/sethome [이름]', '지금 위치를 집으로 저장 (3개까지, 이름 없으면 "집")'],
            ['/home [이름]  /homes', '집으로 이동 / 집 목록 (목록의 이름을 누르면 이동)'],
            ['/delhome <이름>', '집 지우기'],
            ['/back', '이전 위치 또는 죽은 곳으로'],
            ['/spawn', '스폰으로'],
            ['/tpa <이름>', '친구에게 이동 요청 → 친구가 /tpaccept (거절 /tpdeny)'],
            ['/story', '본 스토리 컷씬 다시 보기'],
            ['참고', '이동 명령은 30초마다 한 번, 싸운 뒤 10초 동안은 쓸 수 없어요']
        ]
    },
    '키': {
        title: '주요 키 (모드 기본값)',
        lines: [
            ['E', '인벤토리 — 왼쪽 위 아이콘으로 퀘스트·땅 지도·팀'],
            ['R / U', '아이템 위에서 만드는 법 / 쓰이는 곳 (JEI)'],
            ['J / M', '큰 지도 (JourneyMap) / 땅 차지 지도 (FTB Chunks)'],
            ['B', '배낭 열기 (등에 메거나 손에 들고)'],
            ['G', '장신구 슬롯 (Curios)'],
            ['` (숫자 1 왼쪽)', '누른 채로 캐면 붙어 있는 광석·나무를 한 번에 (FTB Ultimine)'],
            ['V', '음성 채팅 설정'],
            ['키가 겹치면', '설정 → 조작에서 검색창에 이름을 치면 찾을 수 있어요']
        ]
    },
    '정수': {
        title: '보스 정수',
        lines: [
            ['무엇', '테크 기계·고급 장비를 여는 재료. 잠든 → 하급 → 중급 → 상급 → 전설'],
            ['얻는 곳', '몬스터(잠든·하급), 보스, 정예 몬스터, 던전·요새·엔드 시티 상자, 보스 퀘스트 보상'],
            ['반복 의뢰', '퀘스트북 "모드 가이드 → 정수 의뢰소" 는 몇 번이고 반복할 수 있어요'],
            ['자동화', '잠든 정수를 Create 기계 손으로 누르면 정수가 나와요 (보스 트로피를 들려 두면 닳지 않음)']
        ]
    },
    '정예': {
        title: '정예 몬스터',
        lines: [
            ['구별', '머리 위에 [정예] 이름이 붙은 몬스터. 체력 3배, 공격력 1.5배'],
            ['특성', '강철의·광폭한·날쌘·재생하는·불타는·맹독의·서리의·흡혈하는·폭발하는 (폭발하는은 죽을 때 터져요!)'],
            ['어디서', '멀리 갈수록 자주 나와요. 네더·엔드는 더 자주'],
            ['보상', '잠든 정수 2~3개 확정, 하급·중급 정수와 경험치']
        ]
    }
}
const MOREUP_GUIDE_ORDER = ['시작', '명령어', '키', '정수', '정예']

function moreupGuideMenu() {
    let line = Text.of('주제: ').gray()
    MOREUP_GUIDE_ORDER.forEach((topic, i) => {
        if (i > 0) line.append(Text.of(' '))
        line.append(Text.of(`[${topic}]`).aqua().clickRunCommand(`/가이드 ${topic}`).hover(Text.of(`${MOREUP_GUIDE_TOPICS[topic].title} — 누르면 열려요`)))
    })
    return line
}

function moreupGuideShow(player, topic) {
    let t = MOREUP_GUIDE_TOPICS[topic]
    player.tell(Text.of(`━━━ More Up 가이드: ${t.title} ━━━`).gold())
    t.lines.forEach(l => player.tell(Text.of(`  ${l[0]}  `).yellow().append(Text.of(l[1]).white())))
    player.tell(moreupGuideMenu())
}

function moreupGuideMain(player) {
    player.tell(Text.of('━━━ More Up 가이드 ━━━').gold())
    player.tell(Text.of('  궁금한 주제를 눌러 보세요. 다시 보려면 언제든 /가이드').white())
    player.tell(moreupGuideMenu())
}

function moreupGuideCommand(ctx, topic) {
    try {
        let player = ctx.source.player
        if (!player) {
            ctx.source.sendFailure(Text.of('플레이어만 쓸 수 있습니다'))
            return 0
        }
        if (topic == null) moreupGuideMain(player)
        else moreupGuideShow(player, topic)
        return 1
    } catch (e) {
        console.error(`[MoreUp] /가이드 실패: ${e}`)
        return 0
    }
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands } = event
    ;['가이드', 'guide'].forEach(root => {
        let node = Commands.literal(root).executes(ctx => moreupGuideCommand(ctx, null))
        MOREUP_GUIDE_ORDER.forEach(topic => {
            node = node.then(Commands.literal(topic).executes(ctx => moreupGuideCommand(ctx, topic)))
        })
        event.register(node)
    })
})

// 기본 물품 지급. 가방이 가득 차면 발밑에 떨어진다 (give 의 기본 동작)
function moreupGuideGiveKit(player) {
    let given = 0
    MOREUP_GUIDE_STARTER_KIT.forEach(entry => {
        try {
            player.give(Item.of(entry[0], entry[1]))
            given++
        } catch (e) {
            console.error(`[MoreUp] 기본 물품 지급 실패 (${player.name.string}, ${entry[0]}): ${e}`)
        }
    })
    player.tell(Text.of('  처음 오신 기념으로 기본 장비·음식·물·횃불·귀환 두루마리를 드렸어요!').green())
    return given
}

function moreupGuideOnJoin(player, server) {
    try {
        let key = MOREUP_GUIDE_JOIN_KEY + String(player.stringUuid)
        let joins = server.persistentData.getInt(key) + 1
        server.persistentData.putInt(key, joins)
        if (joins === 1) {
            player.server.runCommandSilent(`title ${player.name.string} times 10 70 20`)
            player.server.runCommandSilent(`title ${player.name.string} subtitle {"text":"처음이면 채팅에 /가이드 를 입력해 보세요","color":"yellow"}`)
            player.server.runCommandSilent(`title ${player.name.string} title {"text":"More Up 에 오신 걸 환영해요!","color":"gold"}`)
            player.tell(Text.of(`━━━ ${player.name.string} 님, More Up 에 오신 걸 환영해요! ━━━`).gold())
            player.tell(Text.of('  인벤토리(E) 왼쪽 위의 퀘스트북에서 "메인 스토리" 를 따라가면 돼요').white())
            player.tell(Text.of('  집 저장 /sethome · 집으로 /home · 죽은 곳으로 /back · 친구에게 /tpa').white())
            moreupGuideMain(player)
            moreupGuideGiveKit(player)
            return
        }
        if (joins <= MOREUP_GUIDE_HINT_LOGINS) {
            player.tell(Text.of('[More Up] 도움말: ').gold().append(Text.of('/가이드').aqua().clickRunCommand('/가이드').hover(Text.of('누르면 가이드가 열려요'))))
        }
    } catch (e) {
        console.error(`[MoreUp] 접속 안내 실패: ${e}`)
    }
}

PlayerEvents.loggedIn(event => moreupGuideOnJoin(event.player, event.server))
