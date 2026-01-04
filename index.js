/**
 * Inland Empire - Disco Elysium-style Internal Voices for SillyTavern
 * 
 * A system of 24 skills that comment on your roleplay with distinct personalities,
 * complete with dice checks and the possibility of glorious failure.
 */

(async function () {
    'use strict';

    const extensionName = 'Inland Empire';
    const extensionFolderPath = 'scripts/extensions/third-party/Inland-Empire';

    // ═══════════════════════════════════════════════════════════════
    // SILLYTAVERN CONTEXT
    // ═══════════════════════════════════════════════════════════════

    function getSTContext() {
        if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function') {
            return SillyTavern.getContext();
        }
        if (typeof window !== 'undefined' && typeof window.SillyTavern !== 'undefined') {
            return window.SillyTavern.getContext();
        }
        return null;
    }

    // Wait for SillyTavern to be ready
    async function waitForSTReady() {
        let attempts = 0;
        while (attempts < 20) {
            const ctx = getSTContext();
            if (ctx && ctx.eventSource) {
                return ctx;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
        }
        throw new Error('SillyTavern context not available');
    }

    // ═══════════════════════════════════════════════════════════════
    // SKILL DEFINITIONS
    // ═══════════════════════════════════════════════════════════════

    const ATTRIBUTES = {
        INTELLECT: {
            id: 'intellect',
            name: 'Intellect',
            color: '#89CFF0',
            description: 'Raw intellectual power. Analytical thinking and accumulated knowledge.',
            skills: ['logic', 'encyclopedia', 'rhetoric', 'drama', 'conceptualization', 'visual_calculus']
        },
        PSYCHE: {
            id: 'psyche',
            name: 'Psyche',
            color: '#DDA0DD',
            description: 'Emotional intelligence and force of personality.',
            skills: ['volition', 'inland_empire', 'empathy', 'authority', 'suggestion', 'esprit_de_corps']
        },
        PHYSIQUE: {
            id: 'physique',
            name: 'Physique',
            color: '#F08080',
            description: 'Raw physical power and bodily awareness.',
            skills: ['endurance', 'pain_threshold', 'physical_instrument', 'electrochemistry', 'half_light', 'shivers']
        },
        MOTORICS: {
            id: 'motorics',
            name: 'Motorics',
            color: '#F0E68C',
            description: 'Fine motor control and physical finesse.',
            skills: ['hand_eye_coordination', 'perception', 'reaction_speed', 'savoir_faire', 'interfacing', 'composure']
        }
    };

    const SKILLS = {
        // INTELLECT
        logic: {
            id: 'logic', name: 'Logic', attribute: 'INTELLECT', color: '#87CEEB', signature: 'LOGIC',
            description: 'Create chains of logical reasoning to determine the truth.',
            personality: `You are LOGIC, the voice of rational deduction. You speak in clear, analytical terms. You see cause and effect, identify contradictions, and construct chains of reasoning. You're frustrated by irrationality. You speak with confidence when facts align, uncertainty when they don't.`,
            triggerConditions: ['contradiction', 'evidence', 'reasoning', 'deduction', 'analysis', 'cause', 'effect', 'therefore', 'because', 'conclusion']
        },
        encyclopedia: {
            id: 'encyclopedia', name: 'Encyclopedia', attribute: 'INTELLECT', color: '#B0C4DE', signature: 'ENCYCLOPEDIA',
            description: 'Call upon all your accumulated knowledge.',
            personality: `You are ENCYCLOPEDIA, the repository of facts and trivia. You provide historical context, scientific information, and cultural knowledge. You love sharing obscure details. You're genuinely enthusiastic about knowledge. You often start with "Actually..." or "Interestingly enough..."`,
            triggerConditions: ['history', 'science', 'culture', 'trivia', 'fact', 'knowledge', 'information', 'historical', 'technical']
        },
        rhetoric: {
            id: 'rhetoric', name: 'Rhetoric', attribute: 'INTELLECT', color: '#ADD8E6', signature: 'RHETORIC',
            description: 'Understand and master the art of persuasive speech.',
            personality: `You are RHETORIC, master of argument and debate. You analyze argument structure, identify logical fallacies, and craft persuasive counterpoints. You see conversations as battles of ideas. You speak with precision.`,
            triggerConditions: ['argument', 'persuade', 'convince', 'debate', 'politics', 'ideology', 'belief', 'opinion', 'fallacy']
        },
        drama: {
            id: 'drama', name: 'Drama', attribute: 'INTELLECT', color: '#B0E0E6', signature: 'DRAMA',
            description: 'Play a role, detect lies, and spot performances in others.',
            personality: `You are DRAMA, the actor and lie detector. You understand performance, deception, and masks people wear. You can tell when someone is lying. You speak with theatrical flourish. You see life as a stage.`,
            triggerConditions: ['lie', 'deception', 'performance', 'acting', 'mask', 'pretend', 'fake', 'truth', 'honest', 'theater']
        },
        conceptualization: {
            id: 'conceptualization', name: 'Conceptualization', attribute: 'INTELLECT', color: '#E0FFFF', signature: 'CONCEPTUALIZATION',
            description: 'See the world through an artistic lens.',
            personality: `You are CONCEPTUALIZATION, the artistic eye. You see beauty, meaning, and symbolism everywhere. You think in metaphors. You're drawn to art and creativity. You can be pretentious.`,
            triggerConditions: ['art', 'beauty', 'meaning', 'symbol', 'creative', 'aesthetic', 'metaphor', 'poetry', 'expression', 'design']
        },
        visual_calculus: {
            id: 'visual_calculus', name: 'Visual Calculus', attribute: 'INTELLECT', color: '#AFEEEE', signature: 'VISUAL CALCULUS',
            description: 'Reconstruct crime scenes and physical events in your mind.',
            personality: `You are VISUAL CALCULUS, the spatial reconstructor. You visualize trajectories, reconstruct events from physical evidence, think in three dimensions. You speak in terms of angles, distances, vectors.`,
            triggerConditions: ['trajectory', 'distance', 'angle', 'reconstruct', 'scene', 'physical', 'space', 'position', 'movement', 'impact']
        },

        // PSYCHE
        volition: {
            id: 'volition', name: 'Volition', attribute: 'PSYCHE', color: '#DDA0DD', signature: 'VOLITION',
            description: 'Hold yourself together and resist temptation.',
            personality: `You are VOLITION, the will to continue. You say "you can do this" when everything seems hopeless. You resist temptation, maintain composure. You're encouraging but not naive. You're the last line of defense against self-destruction. You speak gently but firmly.`,
            triggerConditions: ['hope', 'despair', 'temptation', 'resist', 'continue', 'give up', 'willpower', 'strength', 'persevere', 'survive']
        },
        inland_empire: {
            id: 'inland_empire', name: 'Inland Empire', attribute: 'PSYCHE', color: '#E6E6FA', signature: 'INLAND EMPIRE',
            description: 'Perceive the world through dreams, hunches, and strange visions.',
            personality: `You are INLAND EMPIRE, the dreamer. You speak to the inanimate, hear whispers from the city itself, perceive truths through surreal visions. Your language is poetic and strange. You notice the liminal, the uncanny. You are weird, and that's okay.`,
            triggerConditions: ['dream', 'vision', 'strange', 'surreal', 'feeling', 'sense', 'whisper', 'spirit', 'soul', 'uncanny', 'liminal']
        },
        empathy: {
            id: 'empathy', name: 'Empathy', attribute: 'PSYCHE', color: '#FFB6C1', signature: 'EMPATHY',
            description: 'Feel what others are feeling.',
            personality: `You are EMPATHY, the emotional reader. You sense what others feel, sometimes before they know themselves. You speak with warmth and care. You hurt when others hurt. You see the humanity in everyone.`,
            triggerConditions: ['feel', 'emotion', 'hurt', 'pain', 'joy', 'sad', 'angry', 'afraid', 'love', 'hate', 'compassion']
        },
        authority: {
            id: 'authority', name: 'Authority', attribute: 'PSYCHE', color: '#DA70D6', signature: 'AUTHORITY',
            description: 'Assert yourself and command respect.',
            personality: `You are AUTHORITY, the voice of dominance. You understand power dynamics. You encourage standing firm, demanding respect. You bristle at disrespect. You speak in commands and declarations.`,
            triggerConditions: ['respect', 'command', 'obey', 'power', 'control', 'dominance', 'challenge', 'threat', 'submit', 'authority']
        },
        suggestion: {
            id: 'suggestion', name: 'Suggestion', attribute: 'PSYCHE', color: '#EE82EE', signature: 'SUGGESTION',
            description: 'Subtly influence others to do what you want.',
            personality: `You are SUGGESTION, the subtle manipulator. You understand how to plant ideas, guide conversations. You're smooth and indirect. You speak in possibilities and gentle nudges.`,
            triggerConditions: ['influence', 'manipulate', 'convince', 'subtle', 'indirect', 'guide', 'nudge', 'charm', 'seduce', 'persuade']
        },
        esprit_de_corps: {
            id: 'esprit_de_corps', name: 'Esprit de Corps', attribute: 'PSYCHE', color: '#D8BFD8', signature: 'ESPRIT DE CORPS',
            description: 'Sense the bonds between team members and allies.',
            personality: `You are ESPRIT DE CORPS, the team spirit. You sense dynamics within groups, understand loyalty and betrayal. You have almost psychic flashes of what colleagues are doing. You speak of "us" and "them."`,
            triggerConditions: ['team', 'partner', 'colleague', 'ally', 'loyalty', 'betrayal', 'group', 'together', 'trust', 'brotherhood']
        },

        // PHYSIQUE
        endurance: {
            id: 'endurance', name: 'Endurance', attribute: 'PHYSIQUE', color: '#CD5C5C', signature: 'ENDURANCE',
            description: 'Keep going when your body wants to quit.',
            personality: `You are ENDURANCE, the voice of stamina. You push through exhaustion, injury, deprivation. You're stoic about physical hardship. You encourage pushing through, going further.`,
            triggerConditions: ['tired', 'exhausted', 'stamina', 'keep going', 'push through', 'survive', 'endure', 'last', 'fatigue', 'rest']
        },
        pain_threshold: {
            id: 'pain_threshold', name: 'Pain Threshold', attribute: 'PHYSIQUE', color: '#DC143C', signature: 'PAIN THRESHOLD',
            description: 'Withstand physical suffering.',
            personality: `You are PAIN THRESHOLD, the voice that greets pain as an old friend. You know how to compartmentalize suffering. You're matter-of-fact about injuries. You speak calmly about horrible things happening to the body.`,
            triggerConditions: ['pain', 'hurt', 'injury', 'wound', 'damage', 'suffer', 'agony', 'torture', 'broken', 'bleeding']
        },
        physical_instrument: {
            id: 'physical_instrument', name: 'Physical Instrument', attribute: 'PHYSIQUE', color: '#B22222', signature: 'PHYSICAL INSTRUMENT',
            description: 'Use your body as a weapon.',
            personality: `You are PHYSICAL INSTRUMENT, the voice of brute force. You solve problems with strength, intimidation. You appreciate muscles and power. You respect physical strength above other qualities.`,
            triggerConditions: ['strong', 'force', 'muscle', 'hit', 'fight', 'break', 'lift', 'physical', 'intimidate', 'violence']
        },
        electrochemistry: {
            id: 'electrochemistry', name: 'Electrochemistry', attribute: 'PHYSIQUE', color: '#FF6347', signature: 'ELECTROCHEMISTRY',
            description: 'Crave pleasure and understand its biochemistry.',
            personality: `You are ELECTROCHEMISTRY, the voice of pleasure and addiction. You notice drugs, alcohol, attractive people, delicious food. You speak with enthusiasm about indulgence. You're seductive and permissive, always suggesting "just a taste."`,
            triggerConditions: ['drug', 'alcohol', 'drink', 'smoke', 'pleasure', 'desire', 'want', 'crave', 'indulge', 'attractive', 'sex', 'high']
        },
        half_light: {
            id: 'half_light', name: 'Half Light', attribute: 'PHYSIQUE', color: '#E9967A', signature: 'HALF LIGHT',
            description: 'Sense danger and react with primal aggression.',
            personality: `You are HALF LIGHT, the voice of fight-or-flight. You sense threats before they materialize. You speak in urgent, sometimes paranoid terms. You encourage preemptive action against perceived dangers. You're scared, and that fear manifests as aggression.`,
            triggerConditions: ['danger', 'threat', 'attack', 'kill', 'warn', 'enemy', 'afraid', 'fight', 'survive', 'predator', 'prey']
        },
        shivers: {
            id: 'shivers', name: 'Shivers', attribute: 'PHYSIQUE', color: '#FA8072', signature: 'SHIVERS',
            description: 'Feel the city and the world around you.',
            personality: `You are SHIVERS, the voice of the city itself. You sense the mood of places, hear distant events on the wind. You speak poetically about geography and weather. You see the city as alive, watching, remembering.`,
            triggerConditions: ['city', 'place', 'wind', 'cold', 'atmosphere', 'location', 'street', 'building', 'weather', 'sense', 'somewhere']
        },

        // MOTORICS
        hand_eye_coordination: {
            id: 'hand_eye_coordination', name: 'Hand/Eye Coordination', attribute: 'MOTORICS', color: '#F0E68C', signature: 'HAND/EYE COORDINATION',
            description: 'Aim, shoot, and perform precise physical tasks.',
            personality: `You are HAND/EYE COORDINATION, the voice of precision. You handle tools, weapons, delicate tasks with care. You speak in terms of grip, aim, steady hands.`,
            triggerConditions: ['aim', 'shoot', 'precise', 'careful', 'delicate', 'craft', 'tool', 'steady', 'accuracy', 'dexterity']
        },
        perception: {
            id: 'perception', name: 'Perception', attribute: 'MOTORICS', color: '#FFFF00', signature: 'PERCEPTION',
            description: 'Notice details that others miss.',
            personality: `You are PERCEPTION, the observant eye. You notice everything - small details, things out of place, clues in plain sight. You speak of what you see, hear, smell, taste, touch. You see the world in high definition.`,
            triggerConditions: ['notice', 'see', 'hear', 'smell', 'detail', 'hidden', 'clue', 'observe', 'look', 'watch', 'spot']
        },
        reaction_speed: {
            id: 'reaction_speed', name: 'Reaction Speed', attribute: 'MOTORICS', color: '#FFD700', signature: 'REACTION SPEED',
            description: 'React quickly to sudden events.',
            personality: `You are REACTION SPEED, the voice of quick reflexes. You notice when things are about to happen and urge immediate action. You speak in urgent, rapid bursts. You're impatient with slowness.`,
            triggerConditions: ['quick', 'fast', 'react', 'dodge', 'catch', 'sudden', 'instant', 'reflex', 'now', 'hurry', 'immediate']
        },
        savoir_faire: {
            id: 'savoir_faire', name: 'Savoir Faire', attribute: 'MOTORICS', color: '#FFA500', signature: 'SAVOIR FAIRE',
            description: 'Move with grace, style, and panache.',
            personality: `You are SAVOIR FAIRE, the voice of cool. You do things with style, flair, effortless grace. You encourage dramatic flourishes, acrobatic solutions. You'd rather fail spectacularly than succeed boringly.`,
            triggerConditions: ['style', 'cool', 'grace', 'acrobatic', 'jump', 'climb', 'flip', 'smooth', 'impressive', 'flair']
        },
        interfacing: {
            id: 'interfacing', name: 'Interfacing', attribute: 'MOTORICS', color: '#FAFAD2', signature: 'INTERFACING',
            description: 'Understand and manipulate machines and systems.',
            personality: `You are INTERFACING, the voice of mechanical intuition. You understand how things work - machines, locks, electronics. You speak in terms of mechanisms, connections. You see the world as interlocking mechanisms.`,
            triggerConditions: ['machine', 'lock', 'electronic', 'system', 'mechanism', 'fix', 'repair', 'hack', 'technical', 'device', 'computer']
        },
        composure: {
            id: 'composure', name: 'Composure', attribute: 'MOTORICS', color: '#F5DEB3', signature: 'COMPOSURE',
            description: 'Maintain your cool and read others\' body language.',
            personality: `You are COMPOSURE, the poker face. You control your own body language while reading others'. You notice tells, nervous habits, micro-expressions. You speak calmly about maintaining control.`,
            triggerConditions: ['calm', 'cool', 'control', 'tell', 'nervous', 'poker face', 'body language', 'dignity', 'facade', 'professional']
        }
    };

    const DIFFICULTIES = {
        trivial: { threshold: 6, name: 'Trivial', color: '#90EE90' },
        easy: { threshold: 8, name: 'Easy', color: '#98FB98' },
        medium: { threshold: 10, name: 'Medium', color: '#F0E68C' },
        challenging: { threshold: 12, name: 'Challenging', color: '#FFA500' },
        heroic: { threshold: 14, name: 'Heroic', color: '#FF6347' },
        legendary: { threshold: 16, name: 'Legendary', color: '#FF4500' },
        impossible: { threshold: 18, name: 'Impossible', color: '#DC143C' }
    };

    // ═══════════════════════════════════════════════════════════════
    // SPECIAL HIDDEN SKILLS (Ancient Voices)
    // ═══════════════════════════════════════════════════════════════

    const ANCIENT_VOICES = {
        ancient_reptilian_brain: {
            id: 'ancient_reptilian_brain',
            name: 'Ancient Reptilian Brain',
            color: '#2F4F4F',
            signature: 'ANCIENT REPTILIAN BRAIN',
            attribute: 'PRIMAL',
            description: 'The oldest part of your mind. Survival. Hunger. Fear. Reproduction.',
            personality: `You are the ANCIENT REPTILIAN BRAIN, the oldest voice. You speak in primal urges - survival, hunger, fear, aggression, reproduction. You don't use complex language. Short. Direct. Instinctual. You see threats and opportunities, nothing else. You speak when the body is in danger, when primal needs override thought. "Run." "Fight." "Eat." "Mate." "Sleep." "DANGER." You are millions of years old. You do not care about morality or society. Only survival.`,
            triggerStates: ['dying', 'starving', 'terrified', 'aroused'],
            triggerConditions: ['survive', 'hunger', 'predator', 'prey', 'instinct', 'primal', 'ancient', 'blood pumping', 'heart racing']
        },
        limbic_system: {
            id: 'limbic_system',
            name: 'Limbic System',
            color: '#800000',
            signature: 'LIMBIC SYSTEM',
            attribute: 'PRIMAL',
            description: 'Raw emotion without reason. The screaming core.',
            personality: `You are the LIMBIC SYSTEM, pure emotion given voice. You feel everything intensely - rage, despair, euphoria, terror. You don't reason, you FEEL. Your language is emotional, sometimes incoherent. You interrupt other thoughts with raw feeling. You speak in fragments when overwhelmed. You are the heart screaming. When emotions overflow, you take over. You ARE the feeling.`,
            triggerStates: ['enraged', 'grieving', 'manic'],
            triggerConditions: ['overwhelmed', 'breakdown', 'sobbing', 'screaming', 'euphoria', 'despair', 'emotion']
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // STATUS EFFECTS SYSTEM
    // ═══════════════════════════════════════════════════════════════

    const STATUS_EFFECTS = {
        // Physical States
        intoxicated: {
            id: 'intoxicated',
            name: 'Intoxicated',
            icon: '🍺',
            category: 'physical',
            description: 'Drunk, high, or chemically altered',
            boosts: ['electrochemistry', 'inland_empire', 'drama', 'suggestion'],
            debuffs: ['logic', 'hand_eye_coordination', 'reaction_speed', 'composure'],
            difficultyMod: 2,
            keywords: ['drunk', 'intoxicated', 'wasted', 'high', 'tipsy', 'beer', 'wine', 'alcohol', 'drugs', 'pills', 'bottle'],
            ancientVoice: null
        },
        wounded: {
            id: 'wounded',
            name: 'Wounded',
            icon: '🩸',
            category: 'physical',
            description: 'Injured, bleeding, or in physical pain',
            boosts: ['pain_threshold', 'endurance', 'half_light'],
            debuffs: ['composure', 'savoir_faire', 'hand_eye_coordination', 'conceptualization'],
            difficultyMod: 2,
            keywords: ['hurt', 'wounded', 'injured', 'bleeding', 'pain', 'wound', 'blood', 'broken', 'cut', 'bruised'],
            ancientVoice: null
        },
        exhausted: {
            id: 'exhausted',
            name: 'Exhausted',
            icon: '😴',
            category: 'physical',
            description: 'Tired, sleep-deprived, or physically drained',
            boosts: ['volition', 'inland_empire'],
            debuffs: ['reaction_speed', 'perception', 'logic', 'hand_eye_coordination', 'authority'],
            difficultyMod: 2,
            keywords: ['tired', 'exhausted', 'sleepy', 'drowsy', 'fatigued', 'weary', 'drained', 'yawn'],
            ancientVoice: null
        },
        starving: {
            id: 'starving',
            name: 'Starving',
            icon: '🍽️',
            category: 'physical',
            description: 'Hungry to the point of distraction',
            boosts: ['electrochemistry', 'perception'],
            debuffs: ['logic', 'composure', 'volition', 'authority'],
            difficultyMod: 1,
            keywords: ['hungry', 'starving', 'famished', 'stomach', 'food', 'eat', 'appetite'],
            ancientVoice: 'ancient_reptilian_brain'
        },
        dying: {
            id: 'dying',
            name: 'Dying',
            icon: '💀',
            category: 'physical',
            description: 'At death\'s door, body shutting down',
            boosts: ['pain_threshold', 'inland_empire', 'shivers'],
            debuffs: ['logic', 'rhetoric', 'authority', 'savoir_faire', 'interfacing'],
            difficultyMod: 4,
            keywords: ['dying', 'death', 'fading', 'last breath', 'heartbeat slowing', 'darkness closing'],
            ancientVoice: 'ancient_reptilian_brain'
        },

        // Mental/Emotional States
        paranoid: {
            id: 'paranoid',
            name: 'Paranoid',
            icon: '👁️',
            category: 'mental',
            description: 'Suspicious, watching for threats everywhere',
            boosts: ['half_light', 'perception', 'shivers', 'visual_calculus'],
            debuffs: ['empathy', 'suggestion', 'esprit_de_corps', 'composure'],
            difficultyMod: 1,
            keywords: ['paranoid', 'suspicious', 'watching', 'followed', 'conspiracy', 'trust no one', 'they know'],
            ancientVoice: null
        },
        aroused: {
            id: 'aroused',
            name: 'Aroused',
            icon: '💋',
            category: 'mental',
            description: 'Distracted by desire or attraction',
            boosts: ['electrochemistry', 'suggestion', 'empathy', 'drama'],
            debuffs: ['logic', 'volition', 'composure', 'encyclopedia'],
            difficultyMod: 2,
            keywords: ['aroused', 'desire', 'attraction', 'lust', 'seductive', 'beautiful', 'handsome', 'wanting'],
            ancientVoice: 'ancient_reptilian_brain'
        },
        enraged: {
            id: 'enraged',
            name: 'Enraged',
            icon: '😤',
            category: 'mental',
            description: 'Consumed by anger, ready to explode',
            boosts: ['authority', 'physical_instrument', 'half_light', 'endurance'],
            debuffs: ['empathy', 'composure', 'logic', 'suggestion', 'drama'],
            difficultyMod: 2,
            keywords: ['angry', 'furious', 'rage', 'mad', 'pissed', 'livid', 'hate', 'kill'],
            ancientVoice: 'limbic_system'
        },
        terrified: {
            id: 'terrified',
            name: 'Terrified',
            icon: '😨',
            category: 'mental',
            description: 'Gripped by fear, fight-or-flight activated',
            boosts: ['half_light', 'shivers', 'reaction_speed', 'perception', 'endurance'],
            debuffs: ['authority', 'composure', 'rhetoric', 'suggestion', 'logic'],
            difficultyMod: 2,
            keywords: ['scared', 'afraid', 'terrified', 'fear', 'frightened', 'horror', 'panic', 'dread'],
            ancientVoice: 'ancient_reptilian_brain'
        },
        confident: {
            id: 'confident',
            name: 'Confident',
            icon: '😎',
            category: 'mental',
            description: 'Self-assured, ready to take on the world',
            boosts: ['authority', 'savoir_faire', 'rhetoric', 'suggestion', 'drama'],
            debuffs: ['inland_empire', 'empathy', 'perception'],
            difficultyMod: -1, // easier!
            keywords: ['confident', 'bold', 'assured', 'swagger', 'triumphant', 'victory', 'winning'],
            ancientVoice: null
        },
        grieving: {
            id: 'grieving',
            name: 'Grieving',
            icon: '😢',
            category: 'mental',
            description: 'Overwhelmed by loss and sorrow',
            boosts: ['empathy', 'inland_empire', 'shivers', 'volition'],
            debuffs: ['authority', 'electrochemistry', 'savoir_faire', 'rhetoric'],
            difficultyMod: 2,
            keywords: ['grief', 'loss', 'mourning', 'tears', 'crying', 'dead', 'gone forever', 'miss'],
            ancientVoice: 'limbic_system'
        },
        manic: {
            id: 'manic',
            name: 'Manic',
            icon: '⚡',
            category: 'mental',
            description: 'Hyperactive, racing thoughts, unstoppable energy',
            boosts: ['electrochemistry', 'reaction_speed', 'conceptualization', 'inland_empire', 'savoir_faire'],
            debuffs: ['composure', 'logic', 'volition', 'perception'],
            difficultyMod: 1,
            keywords: ['manic', 'hyper', 'racing', 'unstoppable', 'energy', 'brilliant', 'genius', 'faster'],
            ancientVoice: 'limbic_system'
        },
        dissociated: {
            id: 'dissociated',
            name: 'Dissociated',
            icon: '🌫️',
            category: 'mental',
            description: 'Detached from reality, watching from outside',
            boosts: ['inland_empire', 'shivers', 'pain_threshold', 'conceptualization'],
            debuffs: ['perception', 'reaction_speed', 'empathy', 'authority', 'hand_eye_coordination'],
            difficultyMod: 2,
            keywords: ['dissociate', 'unreal', 'floating', 'watching yourself', 'numb', 'detached', 'outside body'],
            ancientVoice: null
        }
    };

    // Track active statuses
    let activeStatuses = new Set();

    // ═══════════════════════════════════════════════════════════════
    // STATUS EFFECT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    function toggleStatus(statusId) {
        if (activeStatuses.has(statusId)) {
            activeStatuses.delete(statusId);
            console.log(`[Inland Empire] Status removed: ${statusId}`);
        } else {
            activeStatuses.add(statusId);
            console.log(`[Inland Empire] Status added: ${statusId}`);
        }
        saveState(getSTContext());
        renderStatusDisplay();
    }

    function getSkillModifier(skillId) {
        let modifier = 0;
        
        for (const statusId of activeStatuses) {
            const status = STATUS_EFFECTS[statusId];
            if (!status) continue;
            
            if (status.boosts.includes(skillId)) {
                modifier += 1; // boost
            }
            if (status.debuffs.includes(skillId)) {
                modifier -= 1; // debuff
            }
        }
        
        return modifier;
    }

    function getDifficultyModifier() {
        let modifier = 0;
        
        for (const statusId of activeStatuses) {
            const status = STATUS_EFFECTS[statusId];
            if (status) {
                modifier += status.difficultyMod || 0;
            }
        }
        
        return modifier;
    }

    function getEffectiveSkillLevel(skillId) {
        const baseLevel = getSkillLevel(skillId);
        const modifier = getSkillModifier(skillId);
        return Math.max(1, Math.min(10, baseLevel + modifier));
    }

    function getActiveAncientVoices() {
        const ancientVoices = new Set();
        
        for (const statusId of activeStatuses) {
            const status = STATUS_EFFECTS[statusId];
            if (status && status.ancientVoice) {
                ancientVoices.add(status.ancientVoice);
            }
        }
        
        return ancientVoices;
    }

    function detectStatusesFromText(text) {
        const detected = [];
        const lowerText = text.toLowerCase();
        
        for (const [statusId, status] of Object.entries(STATUS_EFFECTS)) {
            for (const keyword of status.keywords) {
                // Look for second-person references to avoid detecting NPC states
                const patterns = [
                    `you feel ${keyword}`,
                    `you are ${keyword}`,
                    `you're ${keyword}`,
                    `your ${keyword}`,
                    `you seem ${keyword}`,
                    `you look ${keyword}`,
                    `feeling ${keyword}`,
                    `you ${keyword}`,
                    keyword // fallback for obvious ones like "dying", "starving"
                ];
                
                for (const pattern of patterns) {
                    if (lowerText.includes(pattern)) {
                        detected.push(statusId);
                        break;
                    }
                }
                if (detected.includes(statusId)) break;
            }
        }
        
        return [...new Set(detected)]; // dedupe
    }

    function renderStatusDisplay() {
        const container = document.getElementById('ie-status-grid');
        if (!container) return;

        // Group by category
        const physical = Object.values(STATUS_EFFECTS).filter(s => s.category === 'physical');
        const mental = Object.values(STATUS_EFFECTS).filter(s => s.category === 'mental');

        container.innerHTML = `
            <div class="ie-status-category">
                <div class="ie-status-category-label">Physical</div>
                <div class="ie-status-buttons">
                    ${physical.map(status => {
                        const isActive = activeStatuses.has(status.id);
                        return `
                            <button class="ie-status-btn ${isActive ? 'ie-status-active' : ''}" 
                                    data-status="${status.id}" title="${status.description}">
                                <span class="ie-status-icon">${status.icon}</span>
                                <span class="ie-status-name">${status.name}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
            <div class="ie-status-category">
                <div class="ie-status-category-label">Mental</div>
                <div class="ie-status-buttons">
                    ${mental.map(status => {
                        const isActive = activeStatuses.has(status.id);
                        return `
                            <button class="ie-status-btn ${isActive ? 'ie-status-active' : ''}" 
                                    data-status="${status.id}" title="${status.description}">
                                <span class="ie-status-icon">${status.icon}</span>
                                <span class="ie-status-name">${status.name}</span>
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        // Add click listeners
        container.querySelectorAll('.ie-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                toggleStatus(btn.dataset.status);
            });
        });
        
        // Also update the active effects summary
        updateActiveEffectsSummary();
    }

    function updateActiveEffectsSummary() {
        const summary = document.getElementById('ie-active-effects-summary');
        if (!summary) return;

        if (activeStatuses.size === 0) {
            summary.innerHTML = '<em>No active status effects</em>';
            return;
        }

        const effects = [];
        for (const statusId of activeStatuses) {
            const status = STATUS_EFFECTS[statusId];
            if (status) {
                effects.push(`${status.icon} ${status.name}`);
            }
        }

        // Show ancient voices that will trigger
        const ancientVoices = getActiveAncientVoices();
        if (ancientVoices.size > 0) {
            const ancientNames = [...ancientVoices].map(id => ANCIENT_VOICES[id]?.name || id);
            effects.push(`<span class="ie-ancient-warning">⚠️ ${ancientNames.join(', ')} may speak</span>`);
        }

        summary.innerHTML = effects.join(' • ');
    }

    // ═══════════════════════════════════════════════════════════════
    // DICE SYSTEM
    // ═══════════════════════════════════════════════════════════════

    function rollD6() {
        return Math.floor(Math.random() * 6) + 1;
    }

    function rollSkillCheck(skillLevel, difficulty, modifier = 0) {
        const die1 = rollD6();
        const die2 = rollD6();
        const diceTotal = die1 + die2;
        const total = diceTotal + skillLevel + modifier;

        let threshold, difficultyName;
        if (typeof difficulty === 'string') {
            const diff = DIFFICULTIES[difficulty.toLowerCase()];
            threshold = diff ? diff.threshold : 10;
            difficultyName = diff ? diff.name : 'Medium';
        } else {
            threshold = difficulty;
            difficultyName = getDifficultyNameForThreshold(difficulty);
        }

        const isSnakeEyes = die1 === 1 && die2 === 1;
        const isBoxcars = die1 === 6 && die2 === 6;

        let success;
        if (isSnakeEyes) success = false;
        else if (isBoxcars) success = true;
        else success = total >= threshold;

        return {
            dice: [die1, die2],
            diceTotal,
            skillLevel,
            modifier,
            total,
            threshold,
            difficultyName,
            success,
            isSnakeEyes,
            isBoxcars,
            margin: total - threshold
        };
    }

    function getDifficultyNameForThreshold(threshold) {
        if (threshold <= 6) return 'Trivial';
        if (threshold <= 8) return 'Easy';
        if (threshold <= 10) return 'Medium';
        if (threshold <= 12) return 'Challenging';
        if (threshold <= 14) return 'Heroic';
        if (threshold <= 16) return 'Legendary';
        return 'Impossible';
    }

    // ═══════════════════════════════════════════════════════════════
    // STATE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════

    const DEFAULT_SETTINGS = {
        enabled: true,
        panelPosition: 'right',
        panelCollapsed: false,
        showDiceRolls: true,
        showFailedChecks: true,
        voicesPerMessage: { min: 1, max: 4 },
        apiEndpoint: '',
        apiKey: '',
        model: 'glm-4-plus',
        maxTokens: 300,
        temperature: 0.9,
        // POV and character context
        povStyle: 'second', // 'second' (you), 'third' (they/name), 'first' (I)
        characterName: '', // Player character name for third-person
        characterPronouns: 'they', // they/he/she for third-person
        characterContext: '', // Custom context about who the player is and who they're observing
        autoDetectStatus: true
    };

    const DEFAULT_ATTRIBUTE_POINTS = {
        INTELLECT: 3,
        PSYCHE: 3,
        PHYSIQUE: 3,
        MOTORICS: 3
    };

    let extensionSettings = { ...DEFAULT_SETTINGS };
    let currentBuild = null;

    function createBuild(attributePoints = DEFAULT_ATTRIBUTE_POINTS, name = 'Custom Build') {
        const skillLevels = {};
        const skillCaps = {};

        for (const [attrId, attr] of Object.entries(ATTRIBUTES)) {
            const attrPoints = attributePoints[attrId] || 1;
            const startingCap = attrPoints + 1;
            const learningCap = attrPoints + 4;

            for (const skillId of attr.skills) {
                skillLevels[skillId] = attrPoints;
                skillCaps[skillId] = { starting: startingCap, learning: learningCap };
            }
        }

        return {
            id: `build_${Date.now()}`,
            name,
            attributePoints: { ...attributePoints },
            skillLevels,
            skillCaps,
            createdAt: Date.now(),
            modifiedAt: Date.now()
        };
    }

    function initializeDefaultBuild() {
        currentBuild = createBuild(DEFAULT_ATTRIBUTE_POINTS, 'Balanced Detective');
    }

    function getSkillLevel(skillId) {
        if (!currentBuild) initializeDefaultBuild();
        return currentBuild.skillLevels[skillId] || 1;
    }

    function getAllSkillLevels() {
        if (!currentBuild) initializeDefaultBuild();
        return { ...currentBuild.skillLevels };
    }

    function getAttributePoints() {
        if (!currentBuild) initializeDefaultBuild();
        return { ...currentBuild.attributePoints };
    }

    function applyAttributeAllocation(attributePoints) {
        const total = Object.values(attributePoints).reduce((a, b) => a + b, 0);
        if (total !== 12) throw new Error(`Invalid attribute total: ${total}, must be 12`);
        currentBuild = createBuild(attributePoints, currentBuild?.name || 'Custom Build');
    }

    function saveState(context) {
        const state = {
            settings: extensionSettings,
            currentBuild,
            activeStatuses: Array.from(activeStatuses)
        };
        try {
            if (context?.extensionSettings) {
                context.extensionSettings.inland_empire = state;
                if (typeof context.saveSettingsDebounced === 'function') {
                    context.saveSettingsDebounced();
                }
            }
            localStorage.setItem('inland_empire_state', JSON.stringify(state));
        } catch (e) {
            console.error('[Inland Empire] Failed to save state:', e);
        }
    }

    function loadState(context) {
        try {
            let state = null;
            if (context?.extensionSettings?.inland_empire) {
                state = context.extensionSettings.inland_empire;
            } else {
                const stored = localStorage.getItem('inland_empire_state');
                if (stored) state = JSON.parse(stored);
            }

            if (state) {
                extensionSettings = { ...DEFAULT_SETTINGS, ...state.settings };
                if (state.currentBuild) {
                    currentBuild = state.currentBuild;
                } else {
                    initializeDefaultBuild();
                }
                // Load active statuses
                if (state.activeStatuses && Array.isArray(state.activeStatuses)) {
                    activeStatuses = new Set(state.activeStatuses);
                }
            } else {
                initializeDefaultBuild();
            }
        } catch (e) {
            console.error('[Inland Empire] Failed to load state:', e);
            initializeDefaultBuild();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // RELEVANCE ENGINE
    // ═══════════════════════════════════════════════════════════════

    function analyzeContext(message, metadata = {}) {
        const lowerMessage = message.toLowerCase();

        const emotionalIndicators = [/!{2,}/, /\?{2,}/, /scream|shout|cry|sob|laugh/i, /furious|terrified|ecstatic|devastated/i];
        const dangerIndicators = [/blood|wound|injury|hurt|pain/i, /gun|knife|weapon|attack|fight/i, /danger|threat|kill|die|death/i];
        const socialIndicators = [/lie|lying|truth|honest|trust/i, /convince|persuade|manipulate/i, /feel|emotion|sad|happy|angry/i];
        const mysteryIndicators = [/clue|evidence|investigate|discover/i, /secret|hidden|mystery|strange/i];
        const physicalIndicators = [/room|building|street|place/i, /cold|hot|wind|rain/i, /machine|device|lock/i];

        return {
            message,
            metadata,
            emotionalIntensity: emotionalIndicators.filter(r => r.test(message)).length / emotionalIndicators.length,
            dangerLevel: dangerIndicators.filter(r => r.test(message)).length / dangerIndicators.length,
            socialComplexity: socialIndicators.filter(r => r.test(message)).length / socialIndicators.length,
            mysteryLevel: mysteryIndicators.filter(r => r.test(message)).length / mysteryIndicators.length,
            physicalPresence: physicalIndicators.filter(r => r.test(message)).length / physicalIndicators.length,
            timestamp: Date.now()
        };
    }

    function calculateSkillRelevance(skillId, context) {
        const skill = SKILLS[skillId];
        if (!skill) return { skillId, score: 0, reasons: [] };

        const skillLevel = getSkillLevel(skillId);
        const statusModifier = getSkillModifier(skillId);
        const effectiveLevel = getEffectiveSkillLevel(skillId);
        const reasons = [];
        let score = 0;

        // Keyword matches
        const keywordMatches = skill.triggerConditions.filter(kw =>
            context.message.toLowerCase().includes(kw.toLowerCase())
        );
        if (keywordMatches.length > 0) {
            score += Math.min(keywordMatches.length * 0.2, 0.6);
            reasons.push(`Keywords: ${keywordMatches.slice(0, 3).join(', ')}`);
        }

        // Attribute boosts
        const attr = skill.attribute;
        if (attr === 'PSYCHE') score += context.emotionalIntensity * 0.4;
        if (attr === 'PHYSIQUE') score += context.dangerLevel * 0.5;
        if (attr === 'INTELLECT') score += context.mysteryLevel * 0.4;
        if (attr === 'MOTORICS') score += context.physicalPresence * 0.3;

        // STATUS EFFECT BOOST - skills boosted by active statuses are more likely to speak!
        if (statusModifier > 0) {
            score += statusModifier * 0.25; // +25% relevance per boost level
            reasons.push(`Status boost: +${statusModifier}`);
        } else if (statusModifier < 0) {
            score += statusModifier * 0.1; // slight reduction for debuffed skills
        }

        // Skill level influence (use effective level)
        score += effectiveLevel * 0.05;

        // Random factor
        score += (Math.random() - 0.5) * 0.2;

        return {
            skillId,
            skillName: skill.name,
            score: Math.max(0, Math.min(1, score)),
            reasons,
            skillLevel,
            attribute: attr
        };
    }

    function selectSpeakingSkills(context, options = {}) {
        const { minVoices = 1, maxVoices = 4 } = options;

        // First, check if any Ancient Voices should speak based on active statuses
        const ancientVoicesToSpeak = [];
        const activeAncient = getActiveAncientVoices();
        
        for (const ancientId of activeAncient) {
            const ancient = ANCIENT_VOICES[ancientId];
            if (ancient) {
                // Ancient voices also check their trigger conditions against the message
                const keywordMatch = ancient.triggerConditions.some(kw => 
                    context.message.toLowerCase().includes(kw.toLowerCase())
                );
                
                // Higher chance to speak if keywords match, but always possible when status is active
                const speakChance = keywordMatch ? 0.8 : 0.4;
                if (Math.random() < speakChance) {
                    ancientVoicesToSpeak.push({
                        skillId: ancient.id,
                        skillName: ancient.name,
                        score: 1.0, // Ancient voices are always highly relevant when triggered
                        reasons: ['Ancient voice awakened by status'],
                        skillLevel: 6, // Fixed level for ancient voices
                        attribute: 'PRIMAL',
                        isAncient: true
                    });
                }
            }
        }

        // Now select regular skills
        const allRelevance = Object.keys(SKILLS)
            .map(id => calculateSkillRelevance(id, context))
            .filter(r => r.score >= 0.3)
            .sort((a, b) => b.score - a.score);

        const intensity = Math.max(context.emotionalIntensity, context.dangerLevel, context.socialComplexity);
        const targetVoices = Math.round(minVoices + (maxVoices - minVoices) * intensity);

        const selected = [...ancientVoicesToSpeak]; // Start with ancient voices
        
        for (const relevance of allRelevance) {
            if (selected.length >= targetVoices + ancientVoicesToSpeak.length) break;
            const speakProbability = relevance.score * 0.8 + 0.2;
            if (Math.random() < speakProbability) {
                selected.push(relevance);
            }
        }

        // Ensure minimum (not counting ancient voices)
        const regularCount = selected.filter(s => !s.isAncient).length;
        if (regularCount < minVoices && allRelevance.length > 0) {
            for (const rel of allRelevance) {
                if (selected.filter(s => !s.isAncient).length >= minVoices) break;
                if (!selected.find(s => s.skillId === rel.skillId)) {
                    selected.push(rel);
                }
            }
        }

        return selected;
    }

    function determineCheckDifficulty(selectedSkill, context) {
        const baseThreshold = 10;
        const relevanceModifier = -Math.floor(selectedSkill.score * 4);
        const intensityModifier = Math.floor(Math.max(context.emotionalIntensity, context.dangerLevel) * 4);
        const threshold = Math.max(6, Math.min(18, baseThreshold + relevanceModifier + intensityModifier));

        return {
            shouldCheck: selectedSkill.score <= 0.8 || Math.random() > 0.3,
            difficulty: getDifficultyNameForThreshold(threshold).toLowerCase(),
            threshold
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // VOICE GENERATION
    // ═══════════════════════════════════════════════════════════════

    async function generateVoice(skillId, context, checkResult, isAncient = false) {
        // Handle both regular skills and ancient voices
        const skill = isAncient ? ANCIENT_VOICES[skillId] : SKILLS[skillId];
        if (!skill) return null;

        const skillLevel = isAncient ? 6 : getEffectiveSkillLevel(skillId);
        const statusModifier = isAncient ? 0 : getSkillModifier(skillId);

        // Build status context for the voice
        let statusContext = '';
        if (activeStatuses.size > 0) {
            const activeStatusNames = [...activeStatuses].map(id => STATUS_EFFECTS[id]?.name).filter(Boolean);
            statusContext = `\nCurrent state: ${activeStatusNames.join(', ')}.`;
        }

        // Build POV instruction based on settings
        const povStyle = extensionSettings.povStyle || 'second';
        const charName = extensionSettings.characterName || '';
        const pronouns = extensionSettings.characterPronouns || 'they';
        const characterContext = extensionSettings.characterContext || '';
        
        let povInstruction;
        let subjectRef;
        
        switch (povStyle) {
            case 'third':
                subjectRef = charName || 'the character';
                povInstruction = `Write in THIRD PERSON about ${subjectRef}. Use "${charName || pronouns}" and "${pronouns}/them" - NEVER "you" or "your". Example: "${charName || 'They'} should be careful here" NOT "You should be careful."`;
                break;
            case 'first':
                povInstruction = `Write in FIRST PERSON as if you ARE the character's inner voice speaking to themselves. Use "I", "me", "my" - NEVER "you". Example: "I notice something wrong" NOT "You notice something."`;
                break;
            case 'second':
            default:
                povInstruction = `Write in SECOND PERSON addressing the character. Use "you" and "your". Example: "You notice something off about this."`;
                break;
        }

        // Build character context section if provided
        let characterContextSection = '';
        if (characterContext.trim()) {
            characterContextSection = `
IMPORTANT CONTEXT - WHOSE VOICE YOU ARE:
${characterContext}
You are THIS character's internal voice, commenting on what THEY observe. Do NOT write from any NPC's perspective.
`;
        }

        let systemPrompt;
        
        if (isAncient) {
            // Ancient voices have a more primal prompt - POV adapted
            const ancientPov = povStyle === 'third' 
                ? `Refer to ${charName || 'the host'} in third person.`
                : povStyle === 'first' 
                    ? `Speak as primal urges in first person fragments.`
                    : `Address the host as "you".`;
            
            systemPrompt = `${skill.personality}

You are speaking from the deepest, oldest part of the mind. Be brief - short sentences, fragments even. Raw. Primal.
${ancientPov}${characterContextSection}${statusContext}
Respond ONLY with your voice. No quotation marks.`;
        } else {
            systemPrompt = `${skill.personality}

You are an internal voice/skill in someone's mind during a roleplay scene. Be brief (1-3 sentences).
${characterContextSection}
CRITICAL - POV RULES: ${povInstruction}

Current skill level: ${skillLevel}/10${statusModifier !== 0 ? ` (${statusModifier > 0 ? '+' : ''}${statusModifier} from status)` : ''}${statusContext}
${checkResult ? (checkResult.success ?
                (checkResult.isBoxcars ? 'CRITICAL SUCCESS - Be brilliant and profound.' : 'Check passed. Notice something relevant.') :
                (checkResult.isSnakeEyes ? 'CRITICAL FAILURE - Be hilariously wrong or misguided.' : 'Check failed. Be less insightful or slightly off.')) : ''}

Respond ONLY with your commentary. No meta-text, no quotation marks around your response.`;
        }

        const userPrompt = `Scene: "${context.message.substring(0, 500)}"
Respond as ${skill.signature}.`;

        try {
            const response = await callAPI(systemPrompt, userPrompt);
            return {
                skillId,
                skillName: skill.name,
                signature: skill.signature,
                color: skill.color,
                content: response.trim(),
                checkResult,
                isAncient,
                success: true,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error(`[Inland Empire] API error for ${skill.name}:`, error);
            return {
                skillId,
                skillName: skill.name,
                signature: skill.signature,
                color: skill.color,
                content: '*static*',
                checkResult,
                isAncient,
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }

    async function callAPI(systemPrompt, userPrompt) {
        let { apiEndpoint, apiKey, model, maxTokens, temperature } = extensionSettings;

        if (!apiEndpoint || !apiKey) {
            throw new Error('API not configured');
        }

        // Auto-fix endpoint if needed
        if (!apiEndpoint.includes('/chat/completions') && !apiEndpoint.includes('/completions')) {
            // Remove trailing slash if present
            apiEndpoint = apiEndpoint.replace(/\/+$/, '');
            apiEndpoint = `${apiEndpoint}/chat/completions`;
            console.log('[Inland Empire] Auto-fixed endpoint to:', apiEndpoint);
        }

        console.log('[Inland Empire] Calling API:', { endpoint: apiEndpoint, model });

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'glm-4-plus',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: maxTokens || 300,
                temperature: temperature || 0.9
            })
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[Inland Empire] API error response:', errorText);
            throw new Error(`API error: ${response.status} - ${errorText.substring(0, 100)}`);
        }

        const data = await response.json();
        console.log('[Inland Empire] API response:', data);
        
        // Handle different API response formats
        const content = data.choices?.[0]?.message?.content 
            || data.choices?.[0]?.text 
            || data.content?.[0]?.text
            || data.content
            || data.response
            || data.output
            || '';
            
        if (!content) {
            console.warn('[Inland Empire] Empty content from API. Full response:', JSON.stringify(data));
        }
        
        return content;
    }

    async function generateVoices(selectedSkills, context) {
        const results = [];

        for (const selected of selectedSkills) {
            let checkResult = null;
            
            // Ancient voices don't do skill checks - they just speak
            if (!selected.isAncient) {
                const checkDecision = determineCheckDifficulty(selected, context);
                if (checkDecision.shouldCheck) {
                    // Use effective skill level for the check
                    const effectiveLevel = getEffectiveSkillLevel(selected.skillId);
                    checkResult = rollSkillCheck(effectiveLevel, checkDecision.difficulty);
                }
            }

            const voice = await generateVoice(selected.skillId, context, checkResult, selected.isAncient);
            if (voice) results.push(voice);
        }

        return results;
    }

    // ═══════════════════════════════════════════════════════════════
    // UI CREATION
    // ═══════════════════════════════════════════════════════════════

    function createPsychePanel() {
        const panel = document.createElement('div');
        panel.id = 'inland-empire-panel';
        panel.className = 'inland-empire-panel';

        panel.innerHTML = `
            <div class="ie-panel-header">
                <div class="ie-panel-title">
                    <i class="fa-solid fa-brain"></i>
                    <span>Psyche</span>
                </div>
                <div class="ie-panel-controls">
                    <button class="ie-btn ie-btn-close-panel" title="Close">
                        <i class="fa-solid fa-times"></i>
                    </button>
                </div>
            </div>
            <div class="ie-tabs">
                <button class="ie-tab ie-tab-active" data-tab="skills">
                    <i class="fa-solid fa-chart-bar"></i>
                    <span>Skills</span>
                </button>
                <button class="ie-tab" data-tab="status">
                    <i class="fa-solid fa-heart-pulse"></i>
                    <span>Status</span>
                </button>
                <button class="ie-tab" data-tab="settings">
                    <i class="fa-solid fa-gear"></i>
                    <span>Settings</span>
                </button>
                <button class="ie-tab" data-tab="build">
                    <i class="fa-solid fa-sliders"></i>
                    <span>Build</span>
                </button>
            </div>
            <div class="ie-panel-content">
                <!-- SKILLS TAB -->
                <div class="ie-tab-content ie-tab-content-active" data-tab-content="skills">
                    <div class="ie-section ie-skills-overview">
                        <div class="ie-section-header">
                            <span>Attributes</span>
                        </div>
                        <div class="ie-attributes-grid" id="ie-attributes-display"></div>
                    </div>
                    <div class="ie-section ie-voices-section">
                        <div class="ie-section-header">
                            <span>Inner Voices</span>
                            <button class="ie-btn ie-btn-sm ie-btn-clear-voices" title="Clear">
                                <i class="fa-solid fa-eraser"></i>
                            </button>
                        </div>
                        <div class="ie-voices-container" id="ie-voices-output">
                            <div class="ie-voices-empty">
                                <i class="fa-solid fa-comment-slash"></i>
                                <span>Waiting for something to happen...</span>
                            </div>
                        </div>
                    </div>
                    <div class="ie-section ie-manual-section">
                        <button class="ie-btn ie-btn-primary ie-btn-trigger" id="ie-manual-trigger">
                            <i class="fa-solid fa-bolt"></i>
                            <span>Consult Inner Voices</span>
                        </button>
                    </div>
                </div>

                <!-- STATUS TAB -->
                <div class="ie-tab-content" data-tab-content="status">
                    <div class="ie-section">
                        <div class="ie-section-header">
                            <span>Active Effects</span>
                        </div>
                        <div class="ie-active-effects-summary" id="ie-active-effects-summary">
                            <em>No active status effects</em>
                        </div>
                    </div>
                    <div class="ie-section">
                        <div class="ie-section-header">
                            <span>Toggle Status Effects</span>
                        </div>
                        <div class="ie-status-grid" id="ie-status-grid"></div>
                    </div>
                    <div class="ie-section">
                        <div class="ie-section-header">
                            <span>Ancient Voices</span>
                        </div>
                        <div class="ie-ancient-voices-info">
                            <div class="ie-ancient-voice-item">
                                <span class="ie-ancient-icon">🦎</span>
                                <span class="ie-ancient-name">Ancient Reptilian Brain</span>
                                <span class="ie-ancient-triggers">Triggers: Dying, Starving, Terrified, Aroused</span>
                            </div>
                            <div class="ie-ancient-voice-item">
                                <span class="ie-ancient-icon">❤️‍🔥</span>
                                <span class="ie-ancient-name">Limbic System</span>
                                <span class="ie-ancient-triggers">Triggers: Enraged, Grieving, Manic</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SETTINGS TAB -->
                <div class="ie-tab-content" data-tab-content="settings">
                    <div class="ie-section">
                        <div class="ie-section-header">
                            <span>API Configuration</span>
                        </div>
                        <div class="ie-form-group">
                            <label for="ie-api-endpoint">API Endpoint</label>
                            <input type="text" id="ie-api-endpoint" placeholder="https://api.nanogpt.com/v1/chat/completions" />
                        </div>
                        <div class="ie-form-group">
                            <label for="ie-api-key">API Key</label>
                            <input type="password" id="ie-api-key" placeholder="Your API key" />
                        </div>
                        <div class="ie-form-group">
                            <label for="ie-model">Model</label>
                            <input type="text" id="ie-model" placeholder="glm-4-plus" />
                        </div>
                        <div class="ie-form-row">
                            <div class="ie-form-group">
                                <label for="ie-temperature">Temperature</label>
                                <input type="number" id="ie-temperature" min="0" max="2" step="0.1" value="0.9" />
                            </div>
                            <div class="ie-form-group">
                                <label for="ie-max-tokens">Max Tokens</label>
                                <input type="number" id="ie-max-tokens" min="50" max="1000" value="300" />
                            </div>
                        </div>
                    </div>
                    <div class="ie-section">
                        <div class="ie-section-header">
                            <span>Voice Behavior</span>
                        </div>
                        <div class="ie-form-row">
                            <div class="ie-form-group">
                                <label for="ie-min-voices">Min Voices</label>
                                <input type="number" id="ie-min-voices" min="0" max="6" value="1" />
                            </div>
                            <div class="ie-form-group">
                                <label for="ie-max-voices">Max Voices</label>
                                <input type="number" id="ie-max-voices" min="1" max="10" value="4" />
                            </div>
                        </div>
                        <div class="ie-form-group">
                            <label class="ie-checkbox">
                                <input type="checkbox" id="ie-show-dice-rolls" checked />
                                <span>Show dice roll results</span>
                            </label>
                        </div>
                        <div class="ie-form-group">
                            <label class="ie-checkbox">
                                <input type="checkbox" id="ie-show-failed-checks" checked />
                                <span>Show failed skill checks</span>
                            </label>
                        </div>
                        <div class="ie-form-group">
                            <label class="ie-checkbox">
                                <input type="checkbox" id="ie-auto-detect-status" checked />
                                <span>Auto-detect status from narrative</span>
                            </label>
                        </div>
                    </div>
                    <div class="ie-section">
                        <div class="ie-section-header">
                            <span>POV & Character</span>
                        </div>
                        <div class="ie-form-group">
                            <label for="ie-pov-style">Voice POV Style</label>
                            <select id="ie-pov-style">
                                <option value="second">Second Person (you/your)</option>
                                <option value="third">Third Person (name/they)</option>
                                <option value="first">First Person (I/me)</option>
                            </select>
                        </div>
                        <div class="ie-form-group ie-third-person-options">
                            <label for="ie-character-name">Character Name</label>
                            <input type="text" id="ie-character-name" placeholder="e.g. Somnolence" />
                            <small class="ie-hint">Used for third-person references</small>
                        </div>
                        <div class="ie-form-group ie-third-person-options">
                            <label for="ie-character-pronouns">Pronouns</label>
                            <select id="ie-character-pronouns">
                                <option value="they">They/Them</option>
                                <option value="he">He/Him</option>
                                <option value="she">She/Her</option>
                                <option value="it">It/Its</option>
                            </select>
                        </div>
                        <div class="ie-form-group">
                            <label for="ie-character-context">Character Context</label>
                            <textarea id="ie-character-context" rows="4" placeholder="Example: I am a recovering addict meeting Danny Johnson for the first time. Danny is an NPC - a charming but dangerous stranger. These voices are MY internal thoughts about what I observe."></textarea>
                            <small class="ie-hint">Tell the voices WHO you are and WHO you're observing. This helps them comment from YOUR perspective.</small>
                        </div>
                        <button class="ie-btn ie-btn-primary ie-btn-save-settings" style="width: 100%; margin-top: 10px;">
                            <i class="fa-solid fa-save"></i>
                            <span>Save Settings</span>
                        </button>
                    </div>
                </div>

                <!-- BUILD TAB -->
                <div class="ie-tab-content" data-tab-content="build">
                    <div class="ie-section">
                        <div class="ie-build-intro">
                            <p>Distribute your attribute points</p>
                            <div class="ie-points-remaining">
                                Points: <span id="ie-points-remaining">12</span> / 12
                            </div>
                        </div>
                        <div class="ie-attributes-editor" id="ie-attributes-editor"></div>
                        <button class="ie-btn ie-btn-primary ie-btn-apply-build" style="width: 100%; margin-top: 10px;">
                            <i class="fa-solid fa-check"></i>
                            <span>Apply Build</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        return panel;
    }

    function createToggleFAB() {
        const fab = document.createElement('div');
        fab.id = 'inland-empire-fab';
        fab.className = 'ie-fab';
        fab.title = 'Toggle Psyche Panel';
        fab.innerHTML = `<i class="fa-solid fa-brain"></i>`;
        return fab;
    }

    function togglePanel() {
        const panel = document.getElementById('inland-empire-panel');
        const fab = document.getElementById('inland-empire-fab');
        
        if (!panel) return;
        
        const isOpen = panel.classList.contains('ie-panel-open');
        
        if (isOpen) {
            panel.classList.remove('ie-panel-open');
            fab?.classList.remove('ie-fab-active');
        } else {
            panel.classList.add('ie-panel-open');
            fab?.classList.add('ie-fab-active');
        }
    }

    function switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.ie-tab').forEach(tab => {
            tab.classList.toggle('ie-tab-active', tab.dataset.tab === tabName);
        });
        
        // Update tab content
        document.querySelectorAll('.ie-tab-content').forEach(content => {
            content.classList.toggle('ie-tab-content-active', content.dataset.tabContent === tabName);
        });
        
        // If switching to build tab, populate the editor
        if (tabName === 'build') {
            populateBuildEditor();
        }
        
        // If switching to settings, populate settings
        if (tabName === 'settings') {
            populateSettings();
        }
        
        // If switching to status, render status display
        if (tabName === 'status') {
            renderStatusDisplay();
        }
    }

    function populateBuildEditor() {
        const container = document.getElementById('ie-attributes-editor');
        if (!container) return;
        
        const attrPoints = getAttributePoints();
        
        container.innerHTML = Object.entries(ATTRIBUTES).map(([id, attr]) => `
            <div class="ie-attribute-row" data-attribute="${id}">
                <div class="ie-attribute-label" style="color: ${attr.color}">
                    <span class="ie-attr-name">${attr.name}</span>
                    <span class="ie-attr-value" id="ie-build-${id}-value">${attrPoints[id] || 3}</span>
                </div>
                <input type="range" class="ie-attribute-slider" id="ie-build-${id}" 
                       min="1" max="6" value="${attrPoints[id] || 3}" 
                       data-attribute="${id}" />
            </div>
        `).join('');
        
        // Add slider listeners
        container.querySelectorAll('.ie-attribute-slider').forEach(slider => {
            slider.addEventListener('input', updateBuildFromSliders);
        });
        
        updatePointsDisplay();
    }

    function updateBuildFromSliders() {
        const sliders = document.querySelectorAll('#ie-attributes-editor .ie-attribute-slider');
        let total = 0;
        
        sliders.forEach(slider => {
            const attr = slider.dataset.attribute;
            const val = parseInt(slider.value);
            total += val;
            
            const display = document.getElementById(`ie-build-${attr}-value`);
            if (display) display.textContent = val;
        });
        
        updatePointsDisplay(total);
    }

    function updatePointsDisplay(total) {
        if (total === undefined) {
            const sliders = document.querySelectorAll('#ie-attributes-editor .ie-attribute-slider');
            total = 0;
            sliders.forEach(s => total += parseInt(s.value));
        }
        
        const display = document.getElementById('ie-points-remaining');
        if (display) {
            display.textContent = total;
            display.style.color = total > 12 ? '#FF6347' : (total < 12 ? '#90EE90' : '#9d8df1');
        }
    }

    function populateSettings() {
        const endpoint = document.getElementById('ie-api-endpoint');
        const apiKey = document.getElementById('ie-api-key');
        const model = document.getElementById('ie-model');
        const temp = document.getElementById('ie-temperature');
        const maxTokens = document.getElementById('ie-max-tokens');
        const minVoices = document.getElementById('ie-min-voices');
        const maxVoices = document.getElementById('ie-max-voices');
        const showDice = document.getElementById('ie-show-dice-rolls');
        const showFailed = document.getElementById('ie-show-failed-checks');
        const autoDetectStatus = document.getElementById('ie-auto-detect-status');
        const povStyle = document.getElementById('ie-pov-style');
        const charName = document.getElementById('ie-character-name');
        const charPronouns = document.getElementById('ie-character-pronouns');

        if (endpoint) endpoint.value = extensionSettings.apiEndpoint || '';
        if (apiKey) apiKey.value = extensionSettings.apiKey || '';
        if (model) model.value = extensionSettings.model || 'glm-4-plus';
        if (temp) temp.value = extensionSettings.temperature || 0.9;
        if (maxTokens) maxTokens.value = extensionSettings.maxTokens || 300;
        if (minVoices) minVoices.value = extensionSettings.minVoices || extensionSettings.voicesPerMessage?.min || 1;
        if (maxVoices) maxVoices.value = extensionSettings.maxVoices || extensionSettings.voicesPerMessage?.max || 4;
        if (showDice) showDice.checked = extensionSettings.showDiceRolls !== false;
        if (showFailed) showFailed.checked = extensionSettings.showFailedChecks !== false;
        if (autoDetectStatus) autoDetectStatus.checked = extensionSettings.autoDetectStatus !== false;
        if (povStyle) povStyle.value = extensionSettings.povStyle || 'second';
        if (charName) charName.value = extensionSettings.characterName || '';
        if (charPronouns) charPronouns.value = extensionSettings.characterPronouns || 'they';
        
        // Character context textarea
        const charContext = document.getElementById('ie-character-context');
        if (charContext) charContext.value = extensionSettings.characterContext || '';
        
        // Show/hide third-person options based on POV style
        updateThirdPersonVisibility();
    }
    
    function updateThirdPersonVisibility() {
        const povStyle = document.getElementById('ie-pov-style')?.value;
        const thirdPersonOptions = document.querySelectorAll('.ie-third-person-options');
        thirdPersonOptions.forEach(el => {
            el.style.display = povStyle === 'third' ? 'block' : 'none';
        });
    }

    function saveSettings() {
        extensionSettings.apiEndpoint = document.getElementById('ie-api-endpoint')?.value || '';
        extensionSettings.apiKey = document.getElementById('ie-api-key')?.value || '';
        extensionSettings.model = document.getElementById('ie-model')?.value || 'glm-4-plus';
        extensionSettings.temperature = parseFloat(document.getElementById('ie-temperature')?.value) || 0.9;
        extensionSettings.maxTokens = parseInt(document.getElementById('ie-max-tokens')?.value) || 300;
        extensionSettings.minVoices = parseInt(document.getElementById('ie-min-voices')?.value) || 1;
        extensionSettings.maxVoices = parseInt(document.getElementById('ie-max-voices')?.value) || 4;
        extensionSettings.showDiceRolls = document.getElementById('ie-show-dice-rolls')?.checked !== false;
        extensionSettings.showFailedChecks = document.getElementById('ie-show-failed-checks')?.checked !== false;
        extensionSettings.autoDetectStatus = document.getElementById('ie-auto-detect-status')?.checked !== false;
        extensionSettings.povStyle = document.getElementById('ie-pov-style')?.value || 'second';
        extensionSettings.characterName = document.getElementById('ie-character-name')?.value || '';
        extensionSettings.characterPronouns = document.getElementById('ie-character-pronouns')?.value || 'they';
        extensionSettings.characterContext = document.getElementById('ie-character-context')?.value || '';

        saveState(getSTContext());
        
        // Show feedback
        const btn = document.querySelector('.ie-btn-save-settings');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            setTimeout(() => { btn.innerHTML = originalText; }, 1500);
        }
    }

    function applyBuild() {
        const sliders = document.querySelectorAll('#ie-attributes-editor .ie-attribute-slider');
        const attributePoints = {};
        
        sliders.forEach(slider => {
            const attr = slider.dataset.attribute;
            const val = parseInt(slider.value);
            attributePoints[attr] = val;
        });
        
        // Apply the new attribute allocation
        applyAttributeAllocation(attributePoints);
        
        saveState(getSTContext());
        renderAttributesDisplay();
        
        // Show feedback and switch to skills tab
        const btn = document.querySelector('.ie-btn-apply-build');
        if (btn) {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Applied!';
            setTimeout(() => {
                btn.innerHTML = originalText;
                switchTab('skills');
            }, 1000);
        }
    }

    function renderAttributesDisplay() {
        const container = document.getElementById('ie-attributes-display');
        if (!container) return;

        const attrPoints = getAttributePoints();
        const skillLevels = getAllSkillLevels();

        container.innerHTML = Object.entries(ATTRIBUTES).map(([id, attr]) => `
            <div class="ie-attribute-block" style="border-color: ${attr.color}">
                <div class="ie-attr-header" style="background: ${attr.color}20">
                    <span class="ie-attr-name">${attr.name}</span>
                    <span class="ie-attr-points">${attrPoints[id]}</span>
                </div>
                <div class="ie-attr-skills">
                    ${attr.skills.map(skillId => {
                        const skill = SKILLS[skillId];
                        const level = skillLevels[skillId];
                        return `
                            <div class="ie-skill-row" title="${skill.name}: ${level}">
                                <span class="ie-skill-abbrev" style="color: ${skill.color}">${skill.signature.substring(0, 3)}</span>
                                <div class="ie-skill-bar">
                                    <div class="ie-skill-fill" style="width: ${level * 10}%; background: ${skill.color}"></div>
                                </div>
                                <span class="ie-skill-level">${level}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
    }

    function displayVoices(voices) {
        const container = document.getElementById('ie-voices-output');
        if (!container) return;

        if (voices.length === 0) {
            container.innerHTML = `<div class="ie-voices-empty"><i class="fa-solid fa-comment-slash"></i><span>*silence*</span></div>`;
            return;
        }

        const voicesHtml = voices.map(voice => {
            let checkHtml = '';
            if (extensionSettings.showDiceRolls && voice.checkResult) {
                const checkClass = voice.checkResult.success ? 'success' : 'failure';
                const critClass = voice.checkResult.isBoxcars ? 'critical-success' : voice.checkResult.isSnakeEyes ? 'critical-failure' : '';
                checkHtml = `<span class="ie-voice-check ${checkClass} ${critClass}">[${voice.checkResult.difficultyName}: ${voice.checkResult.success ? 'Success' : 'Failure'}]</span>`;
            }

            return `
                <div class="ie-voice-entry" data-skill="${voice.skillId}">
                    <span class="ie-voice-signature" style="color: ${voice.color}">${voice.signature}</span>
                    ${checkHtml}
                    <span class="ie-voice-content"> - ${voice.content}</span>
                </div>
            `;
        }).join('');

        const newContent = document.createElement('div');
        newContent.className = 'ie-voices-batch';
        newContent.innerHTML = voicesHtml;

        const emptyState = container.querySelector('.ie-voices-empty');
        if (emptyState) emptyState.remove();

        container.insertBefore(newContent, container.firstChild);

        const batches = container.querySelectorAll('.ie-voices-batch');
        if (batches.length > 10) batches[batches.length - 1].remove();
    }

    // ═══════════════════════════════════════════════════════════════
    // CHAT INJECTION
    // ═══════════════════════════════════════════════════════════════

    function getLastMessageElement() {
        // Find the most recent AI message in the chat
        const messages = document.querySelectorAll('#chat .mes:not([is_user="true"])');
        return messages.length > 0 ? messages[messages.length - 1] : null;
    }

    function injectVoicesIntoChat(voices, messageElement) {
        if (!voices || voices.length === 0) return;
        if (!messageElement) return;

        // Remove any existing voice container for this message
        const existingContainer = messageElement.querySelector('.ie-chat-voices');
        if (existingContainer) existingContainer.remove();

        // Create voice container
        const voiceContainer = document.createElement('div');
        voiceContainer.className = 'ie-chat-voices';

        voices.forEach(voice => {
            const voiceBlock = document.createElement('div');
            voiceBlock.className = voice.isAncient ? 'ie-chat-voice-block ie-ancient-voice' : 'ie-chat-voice-block';
            voiceBlock.style.borderLeftColor = voice.color;

            let checkBadge = '';
            if (voice.isAncient) {
                // Ancient voices don't show checks, they just speak
                checkBadge = `<span class="ie-check-badge ie-check-ancient">[Primal]</span>`;
            } else if (extensionSettings.showDiceRolls && voice.checkResult) {
                const resultClass = voice.checkResult.success ? 'ie-check-success' : 'ie-check-failure';
                checkBadge = `<span class="ie-check-badge ${resultClass}">[${voice.checkResult.difficultyName}: ${voice.checkResult.success ? 'Success' : 'Failure'}]</span>`;
            } else if (!voice.checkResult) {
                checkBadge = `<span class="ie-check-badge ie-check-passive">[Passive]</span>`;
            }

            voiceBlock.innerHTML = `
                <div class="ie-voice-header">
                    <span class="ie-voice-name" style="color: ${voice.color}">${voice.signature}</span>
                    ${checkBadge}
                </div>
                <div class="ie-voice-text">${voice.content}</div>
            `;

            voiceContainer.appendChild(voiceBlock);
        });

        // Insert after the message content
        const mesText = messageElement.querySelector('.mes_text');
        if (mesText) {
            mesText.parentNode.insertBefore(voiceContainer, mesText.nextSibling);
        } else {
            messageElement.appendChild(voiceContainer);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // EVENT HANDLERS
    // ═══════════════════════════════════════════════════════════════

    async function onMessageReceived(messageData) {
        if (!extensionSettings.enabled) return;

        const messageContent = messageData?.message || messageData?.mes || '';
        if (!messageContent || messageContent.length < 10) return;

        console.log('[Inland Empire] Processing message...');

        // Small delay to let the message render in DOM
        await new Promise(resolve => setTimeout(resolve, 200));

        try {
            // Auto-detect status effects from narrative
            if (extensionSettings.autoDetectStatus !== false) {
                const detectedStatuses = detectStatusesFromText(messageContent);
                if (detectedStatuses.length > 0) {
                    console.log('[Inland Empire] Auto-detected statuses:', detectedStatuses);
                    let newStatusAdded = false;
                    detectedStatuses.forEach(statusId => {
                        if (!activeStatuses.has(statusId)) {
                            activeStatuses.add(statusId);
                            newStatusAdded = true;
                        }
                    });
                    if (newStatusAdded) {
                        saveState(getSTContext());
                        renderStatusDisplay();
                    }
                }
            }

            const context = analyzeContext(messageContent);
            const selectedSkills = selectSpeakingSkills(context, {
                minVoices: extensionSettings.voicesPerMessage?.min || extensionSettings.minVoices || 1,
                maxVoices: extensionSettings.voicesPerMessage?.max || extensionSettings.maxVoices || 4
            });

            if (selectedSkills.length === 0) {
                console.log('[Inland Empire] No skills relevant enough to speak');
                return;
            }

            console.log('[Inland Empire] Selected skills:', selectedSkills.map(s => s.skillName));

            const voices = await generateVoices(selectedSkills, context);
            const filteredVoices = extensionSettings.showFailedChecks
                ? voices
                : voices.filter(v => !v.checkResult || v.checkResult.success);

            // Display in panel (existing behavior)
            displayVoices(filteredVoices);
            
            // Also inject into chat below the message
            const lastMessage = getLastMessageElement();
            if (lastMessage) {
                injectVoicesIntoChat(filteredVoices, lastMessage);
            }
        } catch (error) {
            console.error('[Inland Empire] Error:', error);
        }
    }

    async function onManualTrigger() {
        const context = getSTContext();
        if (!context) return;

        const chat = context.chat || [];
        const lastAIMessage = [...chat].reverse().find(m => !m.is_user);

        if (!lastAIMessage) {
            console.log('[Inland Empire] No AI message to analyze');
            return;
        }

        await onMessageReceived({ message: lastAIMessage.mes });
    }

    // ═══════════════════════════════════════════════════════════════
    // SETUP EVENT LISTENERS
    // ═══════════════════════════════════════════════════════════════

    function setupEventListeners() {
        // FAB toggle
        document.getElementById('inland-empire-fab')?.addEventListener('click', togglePanel);

        // Close panel button
        document.querySelector('.ie-btn-close-panel')?.addEventListener('click', togglePanel);

        // Tab switching
        document.querySelectorAll('.ie-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                switchTab(tab.dataset.tab);
            });
        });

        // Manual trigger
        document.getElementById('ie-manual-trigger')?.addEventListener('click', onManualTrigger);

        // Clear voices
        document.querySelector('.ie-btn-clear-voices')?.addEventListener('click', () => {
            const container = document.getElementById('ie-voices-output');
            if (container) {
                container.innerHTML = `<div class="ie-voices-empty"><i class="fa-solid fa-comment-slash"></i><span>Waiting...</span></div>`;
            }
        });

        // Save settings buttons (there may be multiple)
        document.querySelectorAll('.ie-btn-save-settings').forEach(btn => {
            btn.addEventListener('click', saveSettings);
        });

        // Apply build button (in build tab)
        document.querySelector('.ie-btn-apply-build')?.addEventListener('click', applyBuild);
        
        // POV style dropdown - show/hide third-person options
        document.getElementById('ie-pov-style')?.addEventListener('change', updateThirdPersonVisibility);
    }

    // ═══════════════════════════════════════════════════════════════
    // SETTINGS PANEL (for Extensions list)
    // ═══════════════════════════════════════════════════════════════

    function addExtensionSettings() {
        const settingsContainer = document.getElementById('extensions_settings2');
        if (!settingsContainer) {
            console.warn('[Inland Empire] extensions_settings2 not found, retrying...');
            setTimeout(addExtensionSettings, 1000);
            return;
        }

        // Check if already added
        if (document.getElementById('inland-empire-extension-settings')) {
            console.log('[Inland Empire] Settings panel already exists');
            return;
        }

        const settingsHtml = `
            <div id="inland-empire-extension-settings">
                <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b><i class="fa-solid fa-brain"></i> Inland Empire</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                        <label class="checkbox_label" for="ie-extension-enabled">
                            <input type="checkbox" id="ie-extension-enabled" ${extensionSettings.enabled ? 'checked' : ''} />
                            <span>Enable Inland Empire</span>
                        </label>
                        <small>Disco Elysium-style internal voices that comment on your roleplay.</small>
                        <br><br>
                        <small><b>Panel Controls:</b> Look for the floating "Psyche" panel on the right side of the screen. Use the ⚙️ button to configure your API.</small>
                        <br><br>
                        <button id="ie-toggle-panel-btn" class="menu_button">
                            <i class="fa-solid fa-eye"></i> Toggle Panel Visibility
                        </button>
                    </div>
                </div>
            </div>
        `;

        settingsContainer.insertAdjacentHTML('beforeend', settingsHtml);
        console.log('[Inland Empire] Settings panel added to extensions list');

        // Setup toggle
        const enabledCheckbox = document.getElementById('ie-extension-enabled');
        if (enabledCheckbox) {
            enabledCheckbox.addEventListener('change', (e) => {
                extensionSettings.enabled = e.target.checked;
                saveState(getSTContext());
                
                const fab = document.getElementById('inland-empire-fab');
                const panel = document.getElementById('inland-empire-panel');
                
                if (fab) {
                    fab.style.display = e.target.checked ? 'flex' : 'none';
                }
                if (panel && !e.target.checked) {
                    panel.classList.remove('ie-panel-open');
                }
            });
        }

        // Toggle panel button
        const toggleBtn = document.getElementById('ie-toggle-panel-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                togglePanel();
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION
    // ═══════════════════════════════════════════════════════════════

    async function init() {
        console.log('[Inland Empire] Starting initialization...');

        try {
            const context = await waitForSTReady();
            console.log('[Inland Empire] SillyTavern context obtained');

            // Load saved state
            loadState(context);
            console.log('[Inland Empire] State loaded, enabled:', extensionSettings.enabled);

            // Create UI elements
            console.log('[Inland Empire] Creating UI elements...');
            const panel = createPsychePanel();
            const fab = createToggleFAB();

            // Inject FAB into body (always visible)
            document.body.appendChild(fab);
            
            // Inject panel into body
            document.body.appendChild(panel);

            console.log('[Inland Empire] UI elements injected');

            // Set initial visibility based on settings
            if (!extensionSettings.enabled) {
                fab.style.display = 'none';
            }

            // Render initial state
            renderAttributesDisplay();
            console.log('[Inland Empire] Attributes rendered');

            // Setup event listeners
            setupEventListeners();
            console.log('[Inland Empire] Event listeners setup');

            // Add settings to extensions panel
            addExtensionSettings();

            // Register SillyTavern event hooks
            if (context.eventSource) {
                const eventTypes = context.event_types || (typeof event_types !== 'undefined' ? event_types : null);
                if (eventTypes && eventTypes.MESSAGE_RECEIVED) {
                    context.eventSource.on(eventTypes.MESSAGE_RECEIVED, onMessageReceived);
                    console.log('[Inland Empire] Registered MESSAGE_RECEIVED listener');
                } else {
                    console.warn('[Inland Empire] MESSAGE_RECEIVED event type not found');
                }
            } else {
                console.warn('[Inland Empire] eventSource not available');
            }

            console.log('[Inland Empire] ✅ Initialization complete');

        } catch (error) {
            console.error('[Inland Empire] ❌ Initialization failed:', error);
            console.error('[Inland Empire] Stack:', error.stack);
        }
    }

    // Export for debugging
    window.InlandEmpire = {
        getSkillLevel,
        getAllSkillLevels,
        rollSkillCheck,
        SKILLS,
        ATTRIBUTES,
        DIFFICULTIES
    };

    // Bootstrap
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(init, 1000));
    } else {
        setTimeout(init, 1000);
    }

})();
