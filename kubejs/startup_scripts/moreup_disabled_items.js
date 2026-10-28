// priority: 100
// ============================================================
// More Up: 제작 불가 아이템 목록 (단일 원본)
// 경로: kubejs/startup_scripts/moreup_disabled_items.js
//
// 여기 적은 아이템은
//   - server_scripts/recipes/disabled_items.js 가 레시피를 제거하고
//   - client_scripts/jei_hide.js 가 JEI 목록에서 숨긴다.
//
// items     : 출력 기준으로 레시피를 지울 아이템 ID
// recipeIds : 위 아이템을 만드는 레시피 ID (모드 jar에서 확인한 값).
//             KubeJS가 출력물을 못 읽는 레시피 타입(Create 기계 조합, IF 용해 챔버 등)도 확실히 지우려고 함께 적는다.
//
// 목록을 바꾼 뒤에는 게임/서버를 재시작해야 한다 (startup 스크립트는 /reload 대상이 아님).
// 이미 만들어져 월드에 있는 아이템은 사라지지 않는다.
// ============================================================

global.MOREUP_DISABLED_ITEMS = [
    {
        group: 'Mekanism',
        reason: '테크 모드 무기 (무기는 판타지 모드에서 얻는다)',
        items: ['mekanism:meka_tool', 'mekanism:electric_bow', 'mekanism:flamethrower', 'mekanismadditions:obsidian_tnt'],
        recipeIds: ['mekanism:meka_tool', 'mekanism:electric_bow', 'mekanism:flamethrower', 'mekanismadditions:obsidian_tnt']
    },
    {
        group: 'Applied Energistics 2',
        reason: '테크 모드 무기',
        items: [
            'ae2:matter_cannon', 'ae2:charged_staff', 'ae2:entropy_manipulator', 'ae2:tiny_tnt',
            'ae2:certus_quartz_sword', 'ae2:nether_quartz_sword', 'ae2:fluix_sword'
        ],
        recipeIds: [
            'ae2:tools/matter_cannon', 'ae2:tools/misctools_charged_staff', 'ae2:tools/misctools_entropy_manipulator', 'ae2:misc/tiny_tnt',
            'ae2:tools/certus_quartz_sword', 'ae2:tools/nether_quartz_sword', 'ae2:tools/fluix_sword'
        ]
    },
    {
        group: 'Create',
        reason: '테크 모드 무기',
        items: ['create:potato_cannon', 'create:cardboard_sword'],
        recipeIds: ['create:mechanical_crafting/potato_cannon', 'create:crafting/appliances/cardboard_sword']
    },
    {
        group: 'Create Stuff & Additions',
        reason: '테크 모드 무기',
        items: [
            'create_sa:copper_sword', 'create_sa:zinc_sword', 'create_sa:brass_sword', 'create_sa:rose_quartz_sword',
            'create_sa:experience_sword', 'create_sa:blazing_cleaver', 'create_sa:flamethrower'
            // flamethrower_pr / flamethrower_pr_2 는 언어 파일에만 있고 실제 아이템으로 등록되지 않아 제외
        ],
        recipeIds: [
            'create_sa:copper_sword_recipe', 'create_sa:zinc_sword_recipe', 'create_sa:brass_sword_recipe', 'create_sa:rose_quartz_sword_recipe',
            'create_sa:experience_sword_recipe', 'create_sa:blazing_sword_recipe', 'create_sa:flamethrower_recipe'
        ]
    },
    {
        group: 'Industrial Foregoing',
        reason: '테크 모드 무기',
        items: [
            'industrialforegoing:infinity_hammer', 'industrialforegoing:infinity_trident',
            'industrialforegoing:infinity_launcher', 'industrialforegoing:infinity_nuke'
        ],
        recipeIds: [
            'industrialforegoing:dissolution_chamber/infinity_hammer', 'industrialforegoing:dissolution_chamber/infinity_trident',
            'industrialforegoing:dissolution_chamber/infinity_launcher', 'industrialforegoing:dissolution_chamber/infinity_nuke'
        ]
    },
    {
        group: 'Powah',
        reason: '테크 모드 무기 (맞으면 번개가 떨어지는 투척물)',
        items: ['powah:charged_snowball'],
        recipeIds: ['powah:energizing/charged_snowball']
    },
    {
        group: 'Immersive Aircraft',
        reason: '테크 모드 무기 (비행체 장착 무기)',
        items: ['immersive_aircraft:rotary_cannon', 'immersive_aircraft:heavy_crossbow', 'immersive_aircraft:bomb_bay'],
        recipeIds: ['immersive_aircraft:rotary_cannon', 'immersive_aircraft:heavy_crossbow', 'immersive_aircraft:bomb_bay']
    },
    {
        group: 'Create: Creative',
        reason: '사기 루트: 무한 아이템(상자), 무한 유체(유체 탱크), 무한 회전력(모터)',
        items: ['create:creative_crate', 'create:creative_fluid_tank', 'create:creative_motor'],
        recipeIds: ['create_creative:crate', 'create_creative:tank', 'create_creative:motor']
    }
]

console.info(`[MoreUp] 제작 불가 아이템 그룹 ${global.MOREUP_DISABLED_ITEMS.length}개 등록`)
