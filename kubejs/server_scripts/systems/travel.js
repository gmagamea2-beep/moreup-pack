// priority: 0
// ============================================================
// More Up: 이동 명령어 (2026-10-29, 1.5.4 편의성)
// 경로: kubejs/server_scripts/systems/travel.js
//
//   /sethome [이름]   지금 위치를 집으로 저장 (이름 없으면 "집", 최대 MOREUP_TRAVEL_MAX_HOMES 개, 같은 이름이면 덮어씀)
//   /home [이름]      집으로 이동 (이름 없으면 "집", 집이 하나뿐이면 그곳)
//   /delhome <이름>   집 지우기
//   /homes            집 목록 (이름을 누르면 이동)
//   /back             마지막으로 이동하기 전 위치 또는 죽은 곳으로 (한 번 더 쓰면 다시 돌아옴)
//   /spawn            오버월드 스폰으로
// 제한: 이동끼리 MOREUP_TRAVEL_COOLDOWN_MS 쿨다운, 몹·플레이어와 싸운 뒤 MOREUP_TRAVEL_COMBAT_MS 동안은 이동 불가 (보스전 도망 방지)
//
// 저장: 플레이어 persistentData 는 죽으면 새 플레이어 객체로 옮겨지지 않아(KubeJS 6 에 복사 처리 없음) 서버 persistentData 에
//       "moreupHomes.<UUID>" / "moreupBack.<UUID>" JSON 문자열로 둔다 (월드와 함께 저장, 서버를 껐다 켜도 남음)
// tpa.js 의 /tpaccept 도 moreupTravelSaveBack 으로 /back 위치를 남긴다. 웨이스톤 등 다른 모드의 이동은 기록하지 않는다
// ============================================================

const MOREUP_TRAVEL_MAX_HOMES = 3
const MOREUP_TRAVEL_COOLDOWN_MS = 30000
const MOREUP_TRAVEL_COMBAT_MS = 10000
const MOREUP_TRAVEL_DEATH_PROTECT_TICKS = 100      // 죽은 곳으로 /back 했을 때 화염 저항·저항 (용암·몹 위로 다시 떨어져 연달아 죽는 것 방지)
const MOREUP_TRAVEL_DEFAULT_HOME = '집'
const MOREUP_TRAVEL_NAME_PATTERN = /^[0-9A-Za-z가-힣_-]{1,16}$/
const MOREUP_TRAVEL_HOME_KEY = 'moreupHomes.'
const MOREUP_TRAVEL_BACK_KEY = 'moreupBack.'
const MOREUP_TRAVEL_VOID_DEATH = { outOfWorld: true, 'minecraft:out_of_world': true }

const $TravelPlayer = Java.loadClass('net.minecraft.world.entity.player.Player')

// 메모리에만 두는 값 (서버를 다시 켜면 비어도 됨). 접속을 끊으면 지운다
const moreupTravelCooldown = {}
const moreupTravelCombat = {}

function moreupTravelLoad(server, key) {
    let raw = String(server.persistentData.getString(key))
    if (raw === '') return null
    try { return JSON.parse(raw) } catch (e) { return null }
}

function moreupTravelStore(server, key, value) {
    if (value == null) server.persistentData.remove(key)
    else server.persistentData.putString(key, JSON.stringify(value))
}

function moreupTravelHomes(server, uuid) {
    return moreupTravelLoad(server, MOREUP_TRAVEL_HOME_KEY + uuid) || {}
}

function moreupTravelHere(player, kind) {
    return { dim: String(player.level.dimension), x: player.x, y: player.y, z: player.z, yaw: player.yaw, pitch: player.pitch, kind: kind }
}

// tpa.js 에서도 부른다
function moreupTravelSaveBack(player) {
    moreupTravelStore(player.server, MOREUP_TRAVEL_BACK_KEY + String(player.stringUuid), moreupTravelHere(player, 'teleport'))
}

function moreupTravelDimName(dim) {
    if (dim === 'minecraft:overworld') return '오버월드'
    if (dim === 'minecraft:the_nether') return '네더'
    if (dim === 'minecraft:the_end') return '엔드'
    return dim
}

function moreupTravelDescribe(pos) {
    return `${moreupTravelDimName(pos.dim)} ${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`
}

// 이동할 수 없는 이유 (없으면 null)
function moreupTravelBlocked(player) {
    let uuid = String(player.stringUuid)
    let now = Date.now()
    let fought = moreupTravelCombat[uuid]
    if (fought && now - fought < MOREUP_TRAVEL_COMBAT_MS) {
        return `전투 중에는 이동할 수 없습니다. ${Math.ceil((MOREUP_TRAVEL_COMBAT_MS - (now - fought)) / 1000)}초 뒤에 다시 시도하세요`
    }
    let last = moreupTravelCooldown[uuid]
    if (last && now - last < MOREUP_TRAVEL_COOLDOWN_MS) {
        return `${Math.ceil((MOREUP_TRAVEL_COOLDOWN_MS - (now - last)) / 1000)}초 뒤에 다시 이동할 수 있습니다`
    }
    return null
}

function moreupTravelFail(player, msg) {
    player.tell(Text.of(msg).red())
    return 0
}

// 실제 이동. 떠나기 전 위치를 /back 으로 남긴다
function moreupTravelGo(player, pos, label) {
    let blocked = moreupTravelBlocked(player)
    if (blocked) return moreupTravelFail(player, blocked)
    let from = moreupTravelHere(player, 'teleport')
    try {
        // 첫 인자는 차원 ID 여야 한다 (ServerLevel 을 넘기면 KubeJS 오버로드에 걸려 "Invalid dimension!")
        player.teleportTo(pos.dim, pos.x, pos.y, pos.z, pos.yaw, pos.pitch)
    } catch (e) {
        console.error(`[MoreUp] 이동 실패 (${player.name.string} → ${label} ${pos.dim}): ${e}`)
        return moreupTravelFail(player, `이동하지 못했습니다 (${moreupTravelDimName(pos.dim)} 차원을 찾을 수 없음)`)
    }
    let uuid = String(player.stringUuid)
    moreupTravelStore(player.server, MOREUP_TRAVEL_BACK_KEY + uuid, from)
    moreupTravelCooldown[uuid] = Date.now()
    player.tell(Text.of(`${label}(으)로 이동했습니다 `).green().append(Text.of(`(${moreupTravelDescribe(pos)})`).gray()))
    return 1
}

function moreupTravelHomeNames(server, player) {
    if (!player) return []
    return Object.keys(moreupTravelHomes(server, String(player.stringUuid)))
}

function moreupTravelSuggestHomes(ctx, builder) {
    moreupTravelHomeNames(ctx.source.server, ctx.source.player).forEach(name => builder.suggest(name))
    return builder.buildFuture()
}

function moreupTravelSetHome(ctx, rawName) {
    let player = ctx.source.player
    if (!player) return 0
    let name = String(rawName).trim()
    if (!MOREUP_TRAVEL_NAME_PATTERN.test(name)) {
        return moreupTravelFail(player, '집 이름은 띄어쓰기 없이 한글·영어·숫자·_·- 로 16자까지 쓸 수 있습니다')
    }
    let server = ctx.source.server
    let uuid = String(player.stringUuid)
    let homes = moreupTravelHomes(server, uuid)
    let names = Object.keys(homes)
    let replacing = homes.hasOwnProperty(name)
    if (!replacing && names.length >= MOREUP_TRAVEL_MAX_HOMES) {
        return moreupTravelFail(player, `집은 ${MOREUP_TRAVEL_MAX_HOMES}개까지 저장할 수 있습니다 (${names.join(', ')}). /delhome <이름> 으로 하나 지우세요`)
    }
    homes[name] = moreupTravelHere(player, 'home')
    moreupTravelStore(server, MOREUP_TRAVEL_HOME_KEY + uuid, homes)
    player.tell(Text.of(`"${name}" ${replacing ? '위치를 바꿨습니다' : '집을 저장했습니다'} `).green()
        .append(Text.of(`(${moreupTravelDescribe(homes[name])}, ${Object.keys(homes).length}/${MOREUP_TRAVEL_MAX_HOMES})`).gray()))
    return 1
}

function moreupTravelHome(ctx, rawName) {
    let player = ctx.source.player
    if (!player) return 0
    let homes = moreupTravelHomes(ctx.source.server, String(player.stringUuid))
    let names = Object.keys(homes)
    if (names.length === 0) return moreupTravelFail(player, '저장된 집이 없습니다. 원하는 곳에서 /sethome 을 입력하세요')
    let name = rawName == null ? null : String(rawName).trim()
    if (name == null) name = homes.hasOwnProperty(MOREUP_TRAVEL_DEFAULT_HOME) || names.length > 1 ? MOREUP_TRAVEL_DEFAULT_HOME : names[0]
    if (!homes.hasOwnProperty(name)) {
        moreupTravelFail(player, `"${name}" 집이 없습니다`)
        moreupTravelList(ctx)
        return 0
    }
    return moreupTravelGo(player, homes[name], `집 "${name}"`)
}

function moreupTravelDelHome(ctx, rawName) {
    let player = ctx.source.player
    if (!player) return 0
    let server = ctx.source.server
    let uuid = String(player.stringUuid)
    let homes = moreupTravelHomes(server, uuid)
    let name = String(rawName).trim()
    if (!homes.hasOwnProperty(name)) return moreupTravelFail(player, `"${name}" 집이 없습니다`)
    delete homes[name]
    moreupTravelStore(server, MOREUP_TRAVEL_HOME_KEY + uuid, Object.keys(homes).length > 0 ? homes : null)
    player.tell(Text.of(`"${name}" 집을 지웠습니다`).yellow())
    return 1
}

function moreupTravelList(ctx) {
    let player = ctx.source.player
    if (!player) return 0
    let homes = moreupTravelHomes(ctx.source.server, String(player.stringUuid))
    let names = Object.keys(homes)
    if (names.length === 0) {
        player.tell(Text.of('저장된 집이 없습니다. 원하는 곳에서 /sethome [이름] 을 입력하세요').yellow())
        return 1
    }
    let line = Text.of(`내 집 ${names.length}/${MOREUP_TRAVEL_MAX_HOMES}: `).gold()
    names.forEach((name, i) => {
        if (i > 0) line.append(Text.of('  '))
        line.append(Text.of(`[${name}]`).aqua().clickRunCommand(`/home ${name}`).hover(Text.of(`${moreupTravelDescribe(homes[name])}\n누르면 이동`)))
    })
    player.tell(line)
    return 1
}

function moreupTravelBack(ctx) {
    let player = ctx.source.player
    if (!player) return 0
    let back = moreupTravelLoad(ctx.source.server, MOREUP_TRAVEL_BACK_KEY + String(player.stringUuid))
    if (!back) return moreupTravelFail(player, '돌아갈 위치가 없습니다 (/home·/spawn·/tpa 로 이동했거나 죽은 뒤에 쓸 수 있습니다)')
    let wasDeath = back.kind === 'death'
    let ok = moreupTravelGo(player, back, wasDeath ? '죽은 곳' : '이전 위치')
    if (ok && wasDeath) {
        player.potionEffects.add('minecraft:fire_resistance', MOREUP_TRAVEL_DEATH_PROTECT_TICKS, 0, false, true)
        player.potionEffects.add('minecraft:resistance', MOREUP_TRAVEL_DEATH_PROTECT_TICKS, 1, false, true)
    }
    return ok
}

function moreupTravelSpawn(ctx) {
    let player = ctx.source.player
    if (!player) return 0
    let spawn = ctx.source.server.overworld().getSharedSpawnPos()
    return moreupTravelGo(player, { dim: 'minecraft:overworld', x: spawn.x + 0.5, y: spawn.y, z: spawn.z + 0.5, yaw: player.yaw, pitch: player.pitch }, '스폰')
}

// 명령 실행부: 예외가 나도 서버로 번지지 않게 막고 이유를 남긴다
function moreupTravelSafe(ctx, label, fn) {
    try {
        return fn()
    } catch (e) {
        let player = ctx.source.player
        console.error(`[MoreUp] ${label} 실패 (${player ? player.name.string : '콘솔'}): ${e}`)
        if (player) player.tell(Text.of(`${label} 처리 중 오류가 났습니다. 관리자에게 알려 주세요`).red())
        return 0
    }
}

ServerEvents.commandRegistry(event => {
    const { commands: Commands, arguments: Arguments } = event
    event.register(Commands.literal('sethome')
        .executes(ctx => moreupTravelSafe(ctx, '/sethome', () => moreupTravelSetHome(ctx, MOREUP_TRAVEL_DEFAULT_HOME)))
        .then(Commands.argument('name', Arguments.GREEDY_STRING.create(event))
            .suggests((ctx, builder) => moreupTravelSuggestHomes(ctx, builder))
            .executes(ctx => moreupTravelSafe(ctx, '/sethome', () => moreupTravelSetHome(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'name'))))))
    event.register(Commands.literal('home')
        .executes(ctx => moreupTravelSafe(ctx, '/home', () => moreupTravelHome(ctx, null)))
        .then(Commands.argument('name', Arguments.GREEDY_STRING.create(event))
            .suggests((ctx, builder) => moreupTravelSuggestHomes(ctx, builder))
            .executes(ctx => moreupTravelSafe(ctx, '/home', () => moreupTravelHome(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'name'))))))
    event.register(Commands.literal('delhome')
        .then(Commands.argument('name', Arguments.GREEDY_STRING.create(event))
            .suggests((ctx, builder) => moreupTravelSuggestHomes(ctx, builder))
            .executes(ctx => moreupTravelSafe(ctx, '/delhome', () => moreupTravelDelHome(ctx, Arguments.GREEDY_STRING.getResult(ctx, 'name'))))))
    event.register(Commands.literal('homes').executes(ctx => moreupTravelSafe(ctx, '/homes', () => moreupTravelList(ctx))))
    event.register(Commands.literal('back').executes(ctx => moreupTravelSafe(ctx, '/back', () => moreupTravelBack(ctx))))
    event.register(Commands.literal('spawn').executes(ctx => moreupTravelSafe(ctx, '/spawn', () => moreupTravelSpawn(ctx))))
})

// 싸움 기록: 플레이어가 맞았거나(공격자가 있을 때만, 낙하·굶주림 제외) 무언가를 때렸을 때
EntityEvents.hurt(event => {
    try {
        let victim = event.entity
        let attacker = event.source.getActual()
        if (attacker == null || attacker === victim) return
        let now = Date.now()
        if (victim instanceof $TravelPlayer) moreupTravelCombat[String(victim.stringUuid)] = now
        if (attacker instanceof $TravelPlayer) moreupTravelCombat[String(attacker.stringUuid)] = now
    } catch (e) {
        console.error(`[MoreUp] 이동 제한(전투 기록) 실패: ${e}`)
    }
})

// 죽은 곳을 /back 위치로 남긴다 (공허에 떨어져 죽은 경우는 돌아가도 다시 떨어지므로 남기지 않음)
function moreupTravelOnDeath(player, damageType) {
    try {
        if (!(player instanceof $TravelPlayer)) return
        if (MOREUP_TRAVEL_VOID_DEATH[damageType]) return
        moreupTravelStore(player.server, MOREUP_TRAVEL_BACK_KEY + String(player.stringUuid), moreupTravelHere(player, 'death'))
        delete moreupTravelCombat[String(player.stringUuid)]
        player.tell(Text.of('/back 을 입력하면 죽은 곳으로 돌아갈 수 있습니다').yellow().clickSuggestCommand('/back'))
    } catch (e) {
        console.error(`[MoreUp] 죽은 위치 저장 실패: ${e}`)
    }
}

EntityEvents.death(event => moreupTravelOnDeath(event.entity, String(event.source.getType())))

PlayerEvents.loggedOut(event => {
    let uuid = String(event.player.stringUuid)
    delete moreupTravelCooldown[uuid]
    delete moreupTravelCombat[uuid]
})
