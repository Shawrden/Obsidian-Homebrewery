/**
 * Built-in D&D 5e Homebrewery V3 template library (original / SRD-clean content).
 */

export interface BookTemplate {
	id: string;
	title: string;
	category: string;
	defaultFileName: string;
	description: string;
	content: string;
}

export const BOOK_TEMPLATES: BookTemplate[] = [
	{
		id: "class-subclass",
		title: "Class & Subclass Spread",
		category: "2-Page Class Layout",
		defaultFileName: "Runeblade Class Spread",
		description:
			"Two-page class spread featuring a drop-cap intro, 1–20 progression table frame, core features, quick-build sidebar, and subclass section.",
		content: `# The Runeblade

{{dropcap}} Etched steel hums beside open spellbooks as the runeblade steps into the breach. Blending disciplined martial footwork with carved sigils of elemental force, runeblades channel fleeting wards and shattering blows through a single bound weapon.

## Class Features
As a runeblade, you gain the following class features.

#### Hit Points
**Hit Dice:** 1d10 per runeblade level
**Hit Points at 1st Level:** 10 + your Constitution modifier
**Hit Points at Higher Levels:** 1d10 (or 6) + your Constitution modifier per runeblade level after 1st

#### Proficiencies
**Armor:** Light armor, medium armor, shields
**Weapons:** Simple weapons, martial weapons
**Tools:** Calligrapher's supplies or smith's tools
**Saving Throws:** Constitution, Intelligence
**Skills:** Choose two from Arcana, Athletics, History, Insight, Intimidation, and Perception

#### Equipment
You start with the following equipment, in addition to the equipment granted by your background:
- *(a)* scale mail or *(b)* leather armor and a longbow with 20 arrows
- *(a)* a martial weapon and a shield or *(b)* two martial weapons
- *(a)* a scholar's pack or *(b)* an explorer's pack

\\column

{{classTable,frame
##### The Runeblade
| Level | Proficiency Bonus | Features | Runes Known | Aether Die |
|:---:|:---:|:---|:---:|:---:|
| 1st | +2 | Runic Edge, Sigil Craft | 2 | 1d6 |
| 2nd | +2 | Arcane Infusion, Fighting Style | 2 | 1d6 |
| 3rd | +2 | Runic Order | 3 | 1d6 |
| 4th | +2 | Ability Score Improvement | 3 | 1d6 |
| 5th | +3 | Extra Attack | 4 | 1d8 |
| 6th | +3 | Ward of Iron | 4 | 1d8 |
| 7th | +3 | Order Feature | 5 | 1d8 |
| 8th | +3 | Ability Score Improvement | 5 | 1d8 |
| 9th | +4 | Resonant Strike | 5 | 1d8 |
| 10th | +4 | Dual Inscription | 6 | 1d8 |
| 11th | +4 | Runic Surge | 6 | 1d10 |
| 12th | +4 | Ability Score Improvement | 6 | 1d10 |
| 13th | +5 | Piercing Glyph | 7 | 1d10 |
| 14th | +5 | Bastion Sigil | 7 | 1d10 |
| 15th | +5 | Order Feature | 7 | 1d10 |
| 16th | +5 | Ability Score Improvement | 8 | 1d10 |
| 17th | +6 | Sovereign Brand | 8 | 1d12 |
| 18th | +6 | Eternal Resonance | 8 | 1d12 |
| 19th | +6 | Ability Score Improvement | 9 | 1d12 |
| 20th | +6 | Master of the Living Script | 9 | 1d12 |
}}

{{note
##### Quick Build
Make **Strength** or **Dexterity** your highest ability score, followed by **Intelligence** for your rune save DCs and **Constitution** for durability. Choose the **Sage** or **Soldier** background.
}}

{{footnote PART 1 | CLASSES}}
{{pageNumber,auto}}

\\page

### Runic Edge
At 1st level, you learn to bind a weapon with shimmering script during a short or long rest. While wielding your bound weapon, you may roll your Aether Die once per turn when you hit with a weapon attack, dealing extra force damage equal to the roll.

### Arcane Infusion
Starting at 2nd level, your inscriptions flicker with defensive wards. When you or an ally within 10 feet takes damage, you can use your reaction to expend one Aether Die and reduce that damage by the result plus your Intelligence modifier.

\\column

## Order of the Ember
Runeblades of the Order of the Ember temper their steel in volcanic vents, trading subtle wards for explosive radiant and fire surges.

### 3rd Level: Cinder Brand
When you activate Runic Edge, you can choose to deal fire damage instead of force damage. If the target is illuminated by bright light, add your Intelligence modifier to the damage roll.

### 7th Level: Heartfire Step
As a bonus action, you ignite your cloak of embers and teleport up to 30 feet to an unoccupied space you can see, leaving behind a brief flash of harmless golden sparks.

### 15th Level: Crown of Ash
When you roll initiative and have no expended Aether Dice remaining, you immediately regain two uses of your Aether Die and shed bright light in a 20-foot radius until the end of your first turn.

{{footnote PART 1 | CLASSES}}
{{pageNumber,auto}}
`,
	},
	{
		id: "monster-encounter",
		title: "Monster & Encounter Spread",
		category: "Bestiary & Encounter",
		defaultFileName: "Cinderbound Sentinel Encounter",
		description:
			"Two-column encounter spread with lore, read-aloud box, DM tactics note, and a framed 5e monster statblock.",
		content: `# The Ashvault Threshold

{{dropcap}} Forged to guard forgotten vaults beneath dormant calderas, cinderbound sentinels stand motionless for centuries until trespassing footsteps disturb the cooled slag on the chamber floor.

{{descriptive
Heat shimmers above a cracked basalt bridge spanning a dry magma trench. At the far arch, a towering figure of blackened bronze turns its visor toward you, embers roaring to life between the seams of its armor.
}}

### Encounter Setup
The bridge is 15 feet wide and flanked by 30-foot drops into cooled volcanic glass. Two crumbling braziers near the western arch provide half cover while obscuring sightlines with drifting ash.

\\column

{{note
##### Tactics & Encounter Scaling
The sentinel opens with **Cinder Lance** against heavily armored targets before closing into melee to pin spellcasters with **Seize & Scorch**. To scale this encounter down for lower-tier parties, begin the sentinel with half its hit points and disable its **Magma Carapace** trait.
}}

{{monster,frame
## Cinderbound Sentinel
*Large construct, unaligned*
___
**Armor Class** :: 17 (natural armor)
**Hit Points** :: 114 (12d10 + 48)
**Speed** :: 30 ft.
___
| STR | DEX | CON | INT | WIS | CHA |
|:---:|:---:|:---:|:---:|:---:|:---:|
| 19 (+4) | 10 (+0) | 18 (+4) | 6 (-2) | 12 (+1) | 5 (-3) |
___
**Saving Throws** :: Con +7, Wis +4
**Damage Immunities** :: fire, poison
**Condition Immunities** :: charmed, exhaustion, frightened, poisoned
**Senses** :: darkvision 60 ft., passive Perception 11
**Languages** :: understands Ignan but cannot speak
**Challenge** :: 6 (2,300 XP)
___
***Magma Carapace.*** A creature that touches the sentinel or hits it with a melee attack while within 5 feet takes 5 (1d10) fire damage.

***Immutable Form.*** The sentinel is immune to any spell or effect that would alter its form.
### Actions
***Multiattack.*** The sentinel makes two Greatsword attacks.

***Cinder Greatsword.*** *Melee Weapon Attack:* +7 to hit, reach 10 ft., one target. *Hit:* 15 (2d10 + 4) slashing damage plus 7 (2d6) fire damage.

***Cinder Lance (Recharge 5–6).*** *Ranged Spell Attack:* +7 to hit, range 60 ft., one target. *Hit:* 21 (6d6) fire damage, and the target must succeed on a DC 15 Strength saving throw or be pushed 10 feet.
### Reactions
***Seize & Scorch.*** When a creature within 10 feet attempts to move away, the sentinel makes one Cinder Greatsword attack against it.
}}

{{footnote PART 2 | BESTIARY & ENCOUNTERS}}
{{pageNumber,auto}}
`,
	},
	{
		id: "spells-magic-items",
		title: "Spells & Magic Items Compendium",
		category: "Arcane Reference",
		defaultFileName: "Arcane Compendium",
		description:
			"Multi-column spell index list, formatted spell entries, and magic item descriptions with attunement lore.",
		content: `# Arcane Compendium

{{dropcap}} Scribes of the Astral Athenaeum catalog newly recovered incantations and enchanted relics in compact field folios so wandering arcanists can reference their components and limits at a glance.

## Runic Spell Index

{{spellList,wide
#### Cantrips (0 Level)
- Ember Spark
- Iron Thread
- Whispering Chalk

#### 1st Level
- Aegis of Glass
- Beacon Step
- Starlight Snare

#### 2nd Level
- Crucible Ward
- Echoing Blade
- Mirror Mist

#### 3rd Level
- Dawnbreaker Pulse
- Gravity Anchor
- Vault of Quiet
}}

## Spell Descriptions

#### Beacon Step
*1st-level conjuration*
___
- **Casting Time:** 1 bonus action
- **Range:** 30 feet
- **Components:** V, S
- **Duration:** Instantaneous

You dissolve into golden motes and reappear in an unoccupied space you can see within range. Until the start of your next turn, you shed dim light in a 10-foot radius.

\\column

#### Dawnbreaker Pulse
*3rd-level evocation*
___
- **Casting Time:** 1 action
- **Range:** Self (20-foot radius)
- **Components:** V, S, M (a sliver of sunstone)
- **Duration:** Instantaneous

A ring of radiant force erupts from you. Each hostile creature within 20 feet must make a Constitution saving throw, taking 5d8 radiant damage on a failed save, or half as much on a successful one.

**At Higher Levels.** When you cast this spell using a spell slot of 4th level or higher, the damage increases by 1d8 for each slot level above 3rd.

{{footnote PART 3 | SPELLS & MAGIC ITEMS}}
{{pageNumber,auto}}

\\page

## Magic Items

#### Astrolabe of Quiet Stars
*Wondrous item, rare (requires attunement by a spellcaster)*

While holding this brass-and-quartz astrolabe, you gain a +1 bonus to spell attack rolls and cannot become lost by nonmagical means while the night sky is visible.

***Starward Recall.*** Once per dawn, when you finish a short rest, you can expend no spell slots to recover one expended 1st- or 2nd-level spell slot.

\\column

#### Lantern of the Sunken Choir
*Wondrous item, uncommon*

This sealed copper lantern burns with a cool teal flame that requires no oil and functions underwater. As an action, you can open its shutter to cast *detect magic* without expending a spell slot (once per dawn).

{{note
##### Identifying Unfamiliar Relics
Characters examining a relic during a short rest learn its properties, though hidden curses or sentient personalities often remain concealed until an attunement bond forms.
}}

{{footnote PART 3 | SPELLS & MAGIC ITEMS}}
{{pageNumber,auto}}
`,
	},
	{
		id: "worldbuilding-gazetteer",
		title: "Worldbuilding & Gazetteer Spread",
		category: "Campaign Setting",
		defaultFileName: "Sunken Reach Gazetteer",
		description:
			"Regional gazetteer spread with a drop-cap overview, full-width faction/settlement table, anti-split plot hooks, and gold footnotes.",
		content: `# The Sunken Reach

{{dropcap}} Where jagged limestone sea stacks pierce the morning mist, the settlements of the Sunken Reach cling to terraced cliffs and sunken causeways. Merchants steer shallow-draft skiffs between tidal locks while lantern-keepers chart shifting shoals.

{{wide
### Regional Settlements & Factions
| Settlement / Landmark | Population | Controlling Faction | Primary Trade & Export | Threat Level |
|:---|:---:|:---|:---|:---:|
| **Highgate Terrace** | ~4,200 | Tidewarden Guild | Refined salt, sky-glass lenses | Low |
| **Brinehold Docks** | ~2,800 | Free Captains' Compact | Salvaged bronze, dried kelp | Moderate |
| **Vesper Spire** | ~450 | Order of the Astrolabe | Star charts, arcane inks | High |
| **Drowned Causeway** | Uninhabited | Reefbound Stalkers | Sunken relics, pearlstone | Severe |
}}

## Settlements & Landmarks

### Highgate Terrace
Carved directly into chalk bluffs high above the storm line, Highgate Terrace anchors the region's trade. Gravity-fed lifts haul cargo crates up from the lower tide gates before dusk seals the sea walls.

### Brinehold Docks
Built atop lashed cedar pontoons, Brinehold rises and falls twelve feet with each tide. Disputes are settled swiftly by harbor arbitrators beneath the cracked bell of the Old Customhouse.

\\column

{{descriptive
Salt spray coats the parapet as the harbor bell tolls thrice—the signal that the outer tide gate is closing and no vessel may enter until dawn.
}}

{{no-split
### Local Rumors & Plot Hooks (d4)
| d4 | Hook |
|:---:|:---|
| 1 | A courier skiff drifted into Brinehold without a crew, carrying an unsealed iron coffer. |
| 2 | Miners beneath Highgate broke into a dry limestone vault lined with pre-cataclysm murals. |
| 3 | The beacon atop Vesper Spire flickered violet three nights running, drawing sea serpents shoreward. |
| 4 | Tidewardens offer a 400 gp bounty for recovering a missing survey astrolabe from the Drowned Causeway. |
}}

{{note
##### Campaign Note: Tidal Schedules
Low tide lasts roughly three hours twice each day, briefly exposing the stone arches of the Drowned Causeway and granting dry passage to the outer ruins.
}}

{{footnote GAZETTEER | THE SUNKEN REACH}}
{{pageNumber,auto}}
`,
	},
];
