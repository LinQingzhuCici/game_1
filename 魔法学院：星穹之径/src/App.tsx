/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  Brain, 
  Dumbbell, 
  Sparkles, 
  Users, 
  Lightbulb, 
  Coins, 
  Battery, 
  Calendar, 
  ScrollText, 
  ArrowRight,
  Coffee,
  Trophy,
  AlertCircle,
  ChevronRight,
  Info,
  TrendingUp,
  Wallet,
  Zap,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

// ==========================================
// 1. 游戏配置
// ==========================================
const GAME_CONFIG = {
  MAX_YEAR: 3,
  WEEKS_PER_YEAR: 15,
  DAYS_PER_WEEK: 5,
  SLOTS_PER_DAY: 2,
  INITIAL_GOLD: 100,
  MAX_STAMINA: 100,
  STAMINA_REST: 20,
  STAMINA_COMMISSION_BASE: 15,
  FATIGUE_THRESHOLD: 20,
  RECOVERY_THRESHOLD: 40,
  ATTR_MAX: 100,
  ATTR_ADVANCED_THRESHOLD: 80,
  LEVEL_UP_COUNT: 20,
};

const ATTRIBUTES = [
  { id: 'knowledge', name: '知识', courseName: '魔药课', icon: <BookOpen className="w-4 h-4" />, color: 'bg-blue-600' },
  { id: 'intelligence', name: '智力', courseName: '符文解析', icon: <Brain className="w-4 h-4" />, color: 'bg-purple-600' },
  { id: 'physical', name: '体能', courseName: '战斗训练', icon: <Dumbbell className="w-4 h-4" />, color: 'bg-red-600' },
  { id: 'magic', name: '魔力', courseName: '法术实践', icon: <Sparkles className="w-4 h-4" />, color: 'bg-indigo-600' },
  { id: 'social', name: '社交', courseName: '魔法外交', icon: <Users className="w-4 h-4" />, color: 'bg-green-600' },
  { id: 'inspiration', name: '灵感', courseName: '炼金实验', icon: <Lightbulb className="w-4 h-4" />, color: 'bg-yellow-600' },
];

const COURSE_LEVELS = {
  PRIMARY: { name: '初级', cost: 15, gain: 1 },
  INTERMEDIATE: { name: '中级', cost: 30, gain: 3 },
  ADVANCED: { name: '高级', cost: 55, gain: 5 },
};

const COMMISSION_GRADES = [
  { grade: 'F', threshold: 0, costSlots: 1, goldMin: 20, goldMax: 40 },
  { grade: 'E', threshold: 15, costSlots: 1, goldMin: 40, goldMax: 80 },
  { grade: 'D', threshold: 30, costSlots: 2, goldMin: 100, goldMax: 180 },
  { grade: 'C', threshold: 50, costSlots: 2, goldMin: 200, goldMax: 350 },
  { grade: 'B', threshold: 70, costSlots: 3, goldMin: 400, goldMax: 650 },
  { grade: 'A', threshold: 85, costSlots: 4, goldMin: 800, goldMax: 1200 },
];

const COURSE_FEEDBACK_TEMPLATES: Record<string, string[]> = {
  knowledge: [
    "你在魔药课上精准地控制了火候，药剂呈现出完美的亮紫色。",
    "斯内普教授（化名）对你处理草药的细腻手法表示了难得的肯定。",
    "今天成功熬制了一锅清醒剂，你的笔记被同学们争相传阅。",
    "在辨识毒蘑菇的环节中，你展现出了惊人的记忆力。",
    "坩埚里的烟雾变幻莫测，你从中领悟到了药剂反应的真谛。",
    "你对古代魔药配方的改良尝试引起了导师的极大兴趣。",
    "课程结束时，你成功收集了三瓶高纯度的法力回复液。",
    "虽然炸掉了一个坩埚，但你从中学会了如何中和不稳定的魔力。",
    "你对各种草药的药性了如指掌，回答问题时对答如流。",
    "今天的魔药课让你对微观魔力流动有了更深刻的理解。"
  ],
  intelligence: [
    "复杂的符文在你眼中逐渐变得清晰，你成功解析了上古防御阵法。",
    "导师对你推导符文逻辑的速度感到惊讶，称赞你极具天赋。",
    "在符文重组实验中，你发现了一个能提升法术效率的新节点。",
    "你沉浸在古老卷轴的逻辑海洋中，思维变得前所未有的敏捷。",
    "成功修复了一个破损的传送符文，你对空间坐标有了直观感受。",
    "今天的符文解析课让你意识到，每一个线条都蕴含着宇宙的奥秘。",
    "你用逻辑推理识破了符文陷阱，保护了实验室的安全。",
    "在模拟测试中，你以满分通过了最难的符文逻辑推演。",
    "你对符文语法的掌握日益精进，已经可以尝试撰写简单的咒语。",
    "智慧的火花在脑海中闪烁，你解开了困扰已久的符文难题。"
  ],
  physical: [
    "汗水浸透了训练服，你的剑术动作变得更加流畅且充满力量。",
    "在障碍跑训练中，你灵活地避开了所有魔法陷阱，率先到达终点。",
    "重剑在你手中不再沉重，你感受到了肌肉与意志的完美契合。",
    "教官对你坚韧不拔的毅力表示赞赏，你的体能达到了新高度。",
    "今天的格斗训练中，你成功格挡了高年级学长的全力一击。",
    "高强度的体能训练磨炼了你的意志，你的眼神变得更加锐利。",
    "在模拟战场上，你凭借出色的爆发力突破了敌方的防线。",
    "你对身体重心的控制达到了极致，即使在湿滑地面也能稳如泰山。",
    "每一次挥剑都伴随着破空声，你的力量正在稳步觉醒。",
    "虽然浑身酸痛，但你感受到了身体内部涌动的蓬勃生命力。"
  ],
  magic: [
    "指尖跳动的雷光照亮了整个教室，你成功施展了高阶闪电术。",
    "魔力在体内如潮汐般涌动，你对法术强度的掌控愈发得心应手。",
    "在法术实践课上，你创造了一个持续时间极长的魔法护盾。",
    "导师指出你的施法姿势非常标准，魔力损耗率降到了最低。",
    "你感受到了空气中游离的元素，它们仿佛在回应你的召唤。",
    "成功将火球术压缩到了极致，爆炸威力让所有人为之侧目。",
    "在魔力共鸣实验中，你与法术核心达成了完美的同步。",
    "你学会了如何在施法时保持冷静，这让你的法术更加稳定。",
    "魔杖顶端散发出的光芒温暖而纯净，那是你魔力纯化的证明。",
    "今天的法术实践让你领悟到了魔力转换的终极奥义。"
  ],
  social: [
    "在模拟外交谈判中，你以优雅的谈吐和严密的逻辑赢得了尊重。",
    "你成功调解了两名同学之间的矛盾，展现出了卓越的领导力。",
    "今天的魔法外交课让你学到了如何通过细节洞察他人的意图。",
    "你的演讲极具感染力，同学们纷纷表示愿意支持你的提议。",
    "在晚宴礼仪训练中，你的表现无懈可击，尽显贵族风范。",
    "你学会了如何在复杂的利益关系中寻找平衡点，这非常关键。",
    "导师称赞你具有天生的外交直觉，能够轻易化解尴尬局面。",
    "你与来自异国的留学生进行了深度交流，拓展了国际视野。",
    "在模拟危机公关中，你冷静的应对策略挽救了学院的声誉。",
    "你的社交手腕日益圆滑，已经能够自如地应对各种社交场合。"
  ],
  inspiration: [
    "炼金炉中闪烁着奇异的光芒，你偶然发现了一种新型合金。",
    "灵感如泉涌般迸发，你绘制出了一张前所未有的炼金图纸。",
    "在炼金实验中，你成功将普通铅块转化为了一块纯净的秘银。",
    "你对物质形态转换的独特见解让导师都陷入了沉思。",
    "今天的实验虽然失败了，但产生的奇特现象给了你巨大的启发。",
    "你学会了倾听物质的声音，这让你的炼金成功率大幅提升。",
    "在寻找贤者之石的道路上，你迈出了坚实且富有创意的一步。",
    "你用最廉价的材料炼制出了效果惊人的魔法药剂，真是天才。",
    "炼金阵法的线条在你笔下仿佛有了生命，充满了灵动感。",
    "你对万物守恒定律有了新的感悟，灵感等级得到了质的飞跃。"
  ]
};

const REPORT_COMMENT_TEMPLATES = [
  "表现稳定，未造成明显问题。",
  "尚未触发额外监管措施。",
  "一切仍在可控范围内。",
  "建议继续保持这种低调的进步，不要引起禁林生物的注意。",
  "教务处对你本周未炸毁实验室的行为表示赞赏。",
  "你的存在感正在稳步提升，这并不总是一件好事。",
  "请记住，学院的医疗保险不涵盖自发性人体自燃。",
  "本周评估：合格。至少你还活着。",
  "继续努力，也许下周你就能学会如何正确握住魔杖了。",
  "教务处正在观察你的进度，请务必遵守校规（尤其是半夜三点后的部分）。"
];

// ==========================================
// 2. 突发事件系统
// ==========================================
const RANDOM_EVENTS = [
  // --- 危机事件 (Crisis) ---
  {
    id: 'potion_accident',
    type: 'crisis',
    interactionType: 'decision',
    title: '魔药溢出',
    description: '你在清理实验室时，不小心碰倒了一瓶未完成的药剂，药液正在地板上迅速扩散并冒出诡异的蓝烟。',
    context: 'study',
    relatedStats: ['knowledge', 'magic'],
    goodApproaches: ['中和', '稳定', '清理', '瓶子', '倒入', '抹布', '魔法'],
    badApproaches: ['直接碰', '用手', '乱倒', '破坏', '不管', '逃跑', '踢'],
    options: [
      {
        text: '使用中和剂尝试稳住反应',
        baseSuccessRate: 0.75,
        success: { text: '你精准地投入了中和粉末，反应平息了，你还从中观察到了有趣的结晶现象。', statChanges: { knowledge: 1 } },
        partial: { text: '反应虽然平息了，但由于操作稍显生涩，浪费了一些材料。', statChanges: { knowledge: 0, gold: -5 } },
        fail: { text: '中和剂投放稍慢，虽然平息了反应，但你感到有些疲惫。', statChanges: { stamina: -5, knowledge: -1 } }
      },
      {
        text: '用魔力强行将其封印',
        baseSuccessRate: 0.45,
        success: { text: '你用纯净的魔力包裹住了药液，将其压缩回了瓶中，魔力得到了锻炼。', statChanges: { magic: 2 } },
        partial: { text: '你勉强封印了药液，但魔力的剧烈波动让你感到头晕。', statChanges: { magic: 1, stamina: -5 } },
        fail: { text: '魔力失控，药液溅到了你的长袍上，清理它花了不少金币。', statChanges: { gold: -15, magic: -2 } }
      }
    ]
  },
  {
    id: 'rune_insight',
    type: 'crisis',
    interactionType: 'decision',
    title: '符文共鸣',
    description: '在解析符文时，你突然感受到了一股奇特的律动，墙上的古老刻痕似乎在向你低语。',
    context: 'study',
    relatedStats: ['intelligence', 'inspiration'],
    goodApproaches: ['记录', '分析', '冥想', '触摸', '共鸣', '对比', '临摹'],
    badApproaches: ['擦掉', '覆盖', '大喊', '攻击', '无视', '破坏'],
    options: [
      {
        text: '闭上眼，尝试用意志去共鸣',
        baseSuccessRate: 0.55,
        success: { text: '你进入了一种玄妙的状态，领悟了符文背后的逻辑。', statChanges: { intelligence: 1, inspiration: 1 } },
        partial: { text: '你捕捉到了一些碎片，虽然不完整，但也有所启发。', statChanges: { intelligence: 0, inspiration: 1 } },
        fail: { text: '杂念太多，你只感到一阵轻微的头晕。', statChanges: { stamina: -5, intelligence: -1 } }
      },
      {
        text: '记录下这些律动的频率',
        baseSuccessRate: 0.70,
        success: { text: '详尽的记录为你提供了宝贵的实验数据。', statChanges: { knowledge: 1 } },
        partial: { text: '记录过程有些杂乱，你只整理出了部分有用的信息。', statChanges: { knowledge: 0 } },
        fail: { text: '记录过程枯燥乏味，你感到有些无聊。', statChanges: { inspiration: -1, knowledge: -1 } }
      }
    ]
  },
  {
    id: 'library_encounter',
    type: 'crisis',
    interactionType: 'decision',
    title: '图书馆偶遇',
    description: '你在图书馆查阅资料时，遇到了一位正在寻找古籍的教授，他看起来非常焦急。',
    context: 'any',
    relatedStats: ['social', 'knowledge'],
    goodApproaches: ['询问', '寻找', '目录', '索引', '书架', '帮忙', '整理'],
    badApproaches: ['喧哗', '抢书', '嘲笑', '撞倒', '偷看'],
    options: [
      {
        text: '主动上前提供帮助',
        baseSuccessRate: 0.65,
        success: { text: '你准确地指出了书籍的位置，教授对你留下了深刻印象。', statChanges: { social: 1, knowledge: 1 } },
        partial: { text: '你帮教授找了一会儿，虽然没找到那本，但帮他整理了书架。', statChanges: { social: 1, stamina: -2 } },
        fail: { text: '你找了半天也没找到，教授礼貌地道谢后离开了。', statChanges: { social: -1, intelligence: -1 } }
      },
      {
        text: '展示你对该领域的见解',
        baseSuccessRate: 0.40,
        success: { text: '教授被你的博学所打动，邀请你参加他的私人研讨会。', statChanges: { knowledge: 2 } },
        partial: { text: '教授觉得你的想法很有趣，但也指出了一些明显的错误。', statChanges: { knowledge: 0, intelligence: -1 } },
        fail: { text: '你的见解有些偏差，教授只是礼貌地笑了笑。', statChanges: { intelligence: -2 } }
      }
    ]
  },
  {
    id: 'magic_leak',
    type: 'crisis',
    interactionType: 'decision',
    title: '魔力紊乱',
    description: '由于最近练习过于频繁，你的魔力出现了一些不稳定的波动，周围的物体开始无端漂浮。',
    context: 'study',
    relatedStats: ['magic', 'physical'],
    goodApproaches: ['深呼吸', '冥想', '控制', '引导', '平息', '核心', '收敛'],
    badApproaches: ['爆发', '乱挥', '尖叫', '逃跑', '硬抗', '对抗'],
    options: [
      {
        text: '尝试引导魔力回归核心',
        baseSuccessRate: 0.50,
        success: { text: '你成功驯服了狂暴的能量，魔力变得更加纯净。', statChanges: { magic: 1 } },
        partial: { text: '魔力波动平息了，但你感到精疲力竭。', statChanges: { magic: 0, stamina: -5 } },
        fail: { text: '魔力反噬让你感到一阵虚弱。', statChanges: { magic: -2, stamina: -10 } }
      },
      {
        text: '利用这股波动进行灵感创作',
        baseSuccessRate: 0.35,
        success: { text: '混乱中诞生的美感让你完成了一件奇特的炼金作品。', statChanges: { inspiration: 2, gold: 10 } },
        partial: { text: '你完成了一件半成品，虽然不完美但也有其价值。', statChanges: { inspiration: 1, gold: 2 } },
        fail: { text: '创作失败，漂浮的物体砸在了你脚边。', statChanges: { stamina: -8, inspiration: -1 } }
      }
    ]
  },
  {
    id: 'forbidden_forest_edge',
    type: 'crisis',
    interactionType: 'decision',
    title: '禁林边缘的低语',
    description: '你在学院边缘散步时，听到禁林深处传来一阵奇怪的低语，似乎有某种生物在呼唤你。',
    context: 'any',
    relatedStats: ['magic', 'inspiration'],
    goodApproaches: ['倾听', '观察', '记录', '后退', '魔法', '感知', '标记'],
    badApproaches: ['进入', '大喊', '攻击', '奔跑', '乱闯'],
    options: [
      {
        text: '尝试解析低语中的含义',
        baseSuccessRate: 0.60,
        success: { text: '你听懂了一些古老的词汇，获得了关于自然魔力的启示。', statChanges: { magic: 1, inspiration: 1 } },
        partial: { text: '你只听清了一些模糊的音节，感到一阵莫名的惆绰。', statChanges: { inspiration: 0 } },
        fail: { text: '低语让你感到精神恍惚，产生了一些幻觉。', statChanges: { stamina: -10, magic: -1 } }
      },
      {
        text: '迅速离开并报告给守林人',
        baseSuccessRate: 0.85,
        success: { text: '守林人赞赏你的谨慎，并给了你一些防护建议。', statChanges: { social: 1 } },
        partial: { text: '守林人记录了你的报告，并提醒你以后注意安全。', statChanges: { social: 0 } },
        fail: { text: '守林人不在，你白跑了一趟，还感到有些紧张。', statChanges: { stamina: -5, social: -1 } }
      }
    ]
  },
  {
    id: 'strange_delivery',
    type: 'crisis',
    interactionType: 'decision',
    title: '神秘包裹',
    description: '你收到一个没有署名的包裹，里面传出轻微的滴答声和淡淡的硫磺味。',
    context: 'any',
    relatedStats: ['knowledge', 'intelligence'],
    goodApproaches: ['扫描', '透视', '隔离', '拆解', '测试', '防护', '谨慎'],
    badApproaches: ['直接拆', '摔', '火烧', '丢弃', '乱碰'],
    options: [
      {
        text: '使用探测咒语检查内部',
        baseSuccessRate: 0.70,
        success: { text: '你发现这是一个精巧的炼金闹钟，并学到了其构造原理。', statChanges: { intelligence: 1, knowledge: 1 } },
        partial: { text: '咒语反馈了一些模糊的信息，你判断它暂时没有危险。', statChanges: { intelligence: 0 } },
        fail: { text: '咒语触发了包裹的防御机制，喷了你一脸烟雾。', statChanges: { stamina: -8, intelligence: -1 } }
      },
      {
        text: '小心地拆解包裹',
        baseSuccessRate: 0.50,
        success: { text: '你成功拆解了包裹，发现了一些珍贵的炼金材料。', statChanges: { gold: 15, knowledge: 1 } },
        partial: { text: '拆解过程中损坏了一些零件，但核心材料还算完整。', statChanges: { gold: 5, knowledge: 0 } },
        fail: { text: '拆解不当，包裹内部的材料发生了自燃。', statChanges: { gold: -20, knowledge: -1 } }
      }
    ]
  },
  {
    id: 'wand_malfunction',
    type: 'crisis',
    interactionType: 'decision',
    title: '魔杖罢工',
    description: '在练习法术时，你的魔杖突然喷出了一股黑烟，随后变得冰冷刺骨，不再响应你的魔力。',
    context: 'study',
    relatedStats: ['magic', 'knowledge'],
    goodApproaches: ['检查', '清理', '沟通', '安抚', '魔力', '核心', '修复'],
    badApproaches: ['敲打', '折断', '丢弃', '强行施法', '咒骂'],
    options: [
      {
        text: '尝试用温和的魔力安抚它',
        baseSuccessRate: 0.65,
        success: { text: '魔杖恢复了温暖，你与它的契合度似乎更高了。', statChanges: { magic: 1, inspiration: 1 } },
        partial: { text: '魔杖勉强恢复了响应，但施法依然有些滞涩。', statChanges: { magic: 0 } },
        fail: { text: '魔杖依然没有反应，你感到有些沮丧。', statChanges: { stamina: -5, magic: -1 } }
      },
      {
        text: '检查魔杖表面的纹路',
        baseSuccessRate: 0.75,
        success: { text: '你发现了一些细微的污垢堵塞了魔力通路，清理后恢复了正常。', statChanges: { knowledge: 1 } },
        partial: { text: '你清理了一些表面的划痕，魔杖的情况有所好转。', statChanges: { knowledge: 0 } },
        fail: { text: '你没看出什么问题，只能去校外的魔杖店修理。', statChanges: { gold: -30, knowledge: -1 } }
      }
    ]
  },
  {
    id: 'hallway_duel',
    type: 'crisis',
    interactionType: 'decision',
    title: '走廊纠纷',
    description: '两名高年级学生正在走廊里进行非法的魔法决斗，流弹四射，眼看就要波及到你。',
    context: 'any',
    relatedStats: ['physical', 'social'],
    goodApproaches: ['躲避', '护盾', '制止', '寻找', '老师', '劝解', '防御'],
    badApproaches: ['加入', '围观', '挑衅', '硬抗', '大笑'],
    options: [
      {
        text: '施展防御咒语保护自己',
        baseSuccessRate: 0.70,
        success: { text: '你成功挡住了流弹，并观察到了高阶咒语的运作。', statChanges: { magic: 1 } },
        partial: { text: '护盾挡住了大部分冲击，但你还是被震得手臂发麻。', statChanges: { physical: 0, stamina: -5 } },
        fail: { text: '护盾碎裂，你被冲击波震退了好几步。', statChanges: { stamina: -10, physical: -1 } }
      },
      {
        text: '大声喝止他们的行为',
        baseSuccessRate: 0.45,
        success: { text: '你的气势震慑了他们，事态平息了，你获得了不少声望。', statChanges: { social: 2 } },
        partial: { text: '他们停了下来，但对你的多管闲事感到不满。', statChanges: { social: 0, stamina: -5 } },
        fail: { text: '他们根本不理你，反而把你当成了新的目标。', statChanges: { stamina: -15, social: -2 } }
      }
    ]
  },
  {
    id: 'lost_familiar',
    type: 'crisis',
    interactionType: 'decision',
    title: '迷路的使魔',
    description: '一只看起来非常名贵的猫头鹰撞在了你的窗户上，它腿上绑着一封重要的信件，但它似乎受伤了。',
    context: 'any',
    relatedStats: ['knowledge', 'social'],
    goodApproaches: ['治疗', '喂食', '安抚', '检查', '信件', '主人', '寻找'],
    badApproaches: ['抓捕', '拔毛', '偷信', '驱赶', '不管'],
    options: [
      {
        text: '尝试治疗它的伤口',
        baseSuccessRate: 0.65,
        success: { text: '你成功治愈了它，它感激地蹭了蹭你的手。', statChanges: { knowledge: 1 } },
        partial: { text: '伤口止住了血，但它看起来还是很虚弱。', statChanges: { knowledge: 0 } },
        fail: { text: '你的手法有些生疏，它受惊飞走了。', statChanges: { stamina: -5, knowledge: -1 } }
      },
      {
        text: '根据信件寻找它的主人',
        baseSuccessRate: 0.55,
        success: { text: '你找到了失主，对方是一位慷慨的高级巫师。', statChanges: { gold: 20, social: 1 } },
        partial: { text: '你打听到了失主的信息，并托人将信送了过去。', statChanges: { social: 1, gold: 5 } },
        fail: { text: '你找了很久也没找到，最后只能把它交给校务处。', statChanges: { stamina: -8, social: -1 } }
      }
    ]
  },
  {
    id: 'alchemy_overflow',
    type: 'crisis',
    interactionType: 'decision',
    title: '炼金釜沸腾',
    description: '你的炼金实验进入了关键阶段，但釜内的液体突然开始剧烈沸腾，颜色变得极不稳定。',
    context: 'study',
    relatedStats: ['inspiration', 'intelligence'],
    goodApproaches: ['降温', '添加', '搅拌', '稳定', '观察', '撤火', '魔法'],
    badApproaches: ['加水', '乱搅', '逃跑', '盖盖子', '吹气'],
    options: [
      {
        text: '凭直觉添加一种稳定剂',
        baseSuccessRate: 0.45,
        success: { text: '奇迹发生了！液体变成了纯净的金色，实验大获成功。', statChanges: { inspiration: 2, gold: 10 } },
        partial: { text: '实验虽然成功了，但产物的纯度并不理想。', statChanges: { inspiration: 0, gold: 2 } },
        fail: { text: '釜内发生了小规模爆炸，实验室一片狼藉。', statChanges: { gold: -30, stamina: -10, inspiration: -2 } }
      },
      {
        text: '迅速撤去加热火源',
        baseSuccessRate: 0.80,
        success: { text: '虽然实验中断了，但你保住了昂贵的材料。', statChanges: { intelligence: 1 } },
        partial: { text: '你抢救回了一部分材料，但釜底还是受损了。', statChanges: { intelligence: 0, gold: -5 } },
        fail: { text: '动作慢了点，釜底被烧穿了一个洞。', statChanges: { gold: -20, intelligence: -1 } }
      }
    ]
  },

  // --- 日常事件 (Daily) ---
  {
    id: 'lake_reflection',
    type: 'daily',
    interactionType: 'instant',
    title: '湖边沉思',
    description: '你在黑湖边散步，看着夕阳下的倒影，心情变得格外平静。',
    context: 'any',
    outcome: { text: '宁静的环境让你恢复了一些精力。', statChanges: { stamina: 10 } }
  },
  {
    id: 'cat_friend',
    type: 'daily',
    interactionType: 'instant',
    title: '偶遇校猫',
    description: '一只胖乎乎的橘猫拦住了你的去路，它在你的腿边蹭来蹭去。',
    context: 'any',
    outcome: { text: '你摸了摸它的头，它的咕噜声治愈了你。', statChanges: { inspiration: 1 } }
  },
  {
    id: 'delicious_pie',
    type: 'daily',
    interactionType: 'instant',
    title: '美味馅饼',
    description: '今天食堂供应了特制的南瓜馅饼，味道比平时好得多。',
    context: 'any',
    outcome: { text: '美味的食物让你充满了干劲。', statChanges: { stamina: 5, physical: 1 } }
  },
  {
    id: 'clean_room',
    type: 'daily',
    interactionType: 'instant',
    title: '整理宿舍',
    description: '你花了一点时间整理了乱糟糟的宿舍，感觉清爽多了。',
    context: 'any',
    outcome: { text: '井井有条的环境提升了你的效率。', statChanges: { intelligence: 1 } }
  },
  {
    id: 'overheard_gossip',
    type: 'daily',
    interactionType: 'instant',
    title: '路边闲谈',
    description: '你路过走廊时，无意中听到几个高年级学生在讨论某种稀有草药的产地。',
    context: 'any',
    outcome: { text: '你默默记下了这些信息。', statChanges: { knowledge: 1 } }
  },
  {
    id: 'rainy_day',
    type: 'daily',
    interactionType: 'instant',
    title: '雨中漫步',
    description: '外面下起了小雨，你撑着伞走在校园里，空气清新宜人。',
    context: 'any',
    outcome: { text: '雨声让你更容易集中注意力。', statChanges: { intelligence: 1 } }
  },
  {
    id: 'found_coin',
    type: 'daily',
    interactionType: 'instant',
    title: '路边的幸运',
    description: '你在石板路的缝隙里发现了一枚闪闪发光的银币。',
    context: 'any',
    outcome: { text: '看来今天运气不错。', statChanges: { gold: 5 } }
  },
  {
    id: 'starry_night',
    type: 'daily',
    interactionType: 'instant',
    title: '璀璨星空',
    description: '夜晚的星空异常明亮，你抬头仰望，感受到了宇宙的浩瀚。',
    context: 'any',
    outcome: { text: '星光的指引给了你一些灵感。', statChanges: { inspiration: 1 } }
  },

  // --- 灵感事件 (Inspiration) ---
  {
    id: 'eureka_moment',
    type: 'inspiration',
    interactionType: 'instant',
    title: '灵光一现',
    description: '在阅读一本枯燥的古籍时，你突然将两个看似无关的知识点联系在了一起！',
    context: 'study',
    outcome: { text: '这种顿悟的感觉太棒了，你的智力得到了显著提升。', statChanges: { intelligence: 1, inspiration: 1 } }
  },
  {
    id: 'dream_revelation',
    type: 'inspiration',
    interactionType: 'instant',
    title: '梦中启示',
    description: '昨晚你做了一个奇怪的梦，梦中你正在施展一种从未见过的法术。',
    context: 'any',
    outcome: { text: '醒来后，你对魔力的本质有了新的认识。', statChanges: { magic: 1, inspiration: 1 } }
  },
  {
    id: 'nature_harmony',
    type: 'inspiration',
    interactionType: 'instant',
    title: '自然共鸣',
    description: '你在温室观察植物生长时，突然感受到了生命脉动的节奏。',
    context: 'study',
    outcome: { text: '你领悟到了生命魔力的真谛。', statChanges: { knowledge: 1, inspiration: 1 } }
  },
  {
    id: 'ancient_echo',
    type: 'inspiration',
    interactionType: 'instant',
    title: '远古回响',
    description: '触摸一块古老的石碑时，你脑海中闪过了一些破碎的远古画面。',
    context: 'any',
    outcome: { text: '这些画面虽然模糊，但极大地拓展了你的视野。', statChanges: { intelligence: 1, knowledge: 1 } }
  },
  {
    id: 'elemental_touch',
    type: 'inspiration',
    interactionType: 'instant',
    title: '元素亲和',
    description: '在一次法术练习中，你感觉周围的元素变得异常活跃且亲近。',
    context: 'study',
    outcome: { text: '你与元素的契合度达到了新的高度。', statChanges: { magic: 1, inspiration: 1 } }
  },
  {
    id: 'artistic_spark',
    type: 'inspiration',
    interactionType: 'instant',
    title: '艺术火花',
    description: '你在羊皮纸上随手涂鸦时，竟然画出了一个完美的几何构图，这与某种炼金阵法不谋而合。',
    context: 'any',
    outcome: { text: '这种跨界的联系给了你巨大的启发。', statChanges: { inspiration: 2 } }
  },

  // --- 机会事件 (Opportunity) ---
  {
    id: 'rare_book_sale',
    type: 'opportunity',
    interactionType: 'decision',
    title: '旧书摊位',
    description: '校门口有个学长在处理旧书，其中一本泛黄的笔记看起来很有价值，但他要价不菲。',
    context: 'any',
    relatedStats: ['intelligence'],
    options: [
      {
        text: '支付 50 金币买下它',
        baseSuccessRate: 1.0,
        success: { text: '笔记里记录了许多实用的施法技巧。', statChanges: { gold: -50, knowledge: 2 } },
        partial: { text: '笔记有些残缺，但核心部分还算清晰。', statChanges: { gold: -50, knowledge: 1 } }
      },
      {
        text: '尝试讨价还价',
        baseSuccessRate: 0.50,
        success: { text: '你成功以 30 金币拿下了它。', statChanges: { gold: -30, knowledge: 2 } },
        partial: { text: '学长同意降价到 40 金币，成交。', statChanges: { gold: -40, knowledge: 1 } },
        fail: { text: '学长觉得你没诚意，直接收摊走了。', statChanges: { social: -2 } }
      }
    ]
  },
  {
    id: 'experimental_potion',
    type: 'opportunity',
    interactionType: 'decision',
    title: '试药邀请',
    description: '魔药课教授正在寻找志愿者测试一种新型的“精力药剂”，他保证是安全的。',
    context: 'study',
    relatedStats: ['physical'],
    options: [
      {
        text: '勇敢地喝下它',
        baseSuccessRate: 0.60,
        success: { text: '药剂效果惊人！你感到浑身充满了力量。', statChanges: { stamina: 30, physical: 1 } },
        partial: { text: '药剂让你兴奋了一阵，但也伴随着轻微的失眠。', statChanges: { stamina: 10, physical: 0 } },
        fail: { text: '药剂让你拉了整整一下午肚子。', statChanges: { stamina: -30, physical: -2 } }
      },
      {
        text: '婉言拒绝',
        baseSuccessRate: 1.0,
        success: { text: '你保持了谨慎，虽然没得到好处，但也避开了风险。', statChanges: { intelligence: 1 } },
        partial: { text: '你礼貌地拒绝了，教授表示理解。', statChanges: { social: 0 } }
      }
    ]
  },
  {
    id: 'club_invitation',
    type: 'opportunity',
    interactionType: 'decision',
    title: '社团招新',
    description: '“决斗俱乐部”正在招募新成员，入会费需要 20 金币，但能获得专业指导。',
    context: 'any',
    relatedStats: ['social'],
    options: [
      {
        text: '缴纳费用加入',
        baseSuccessRate: 1.0,
        success: { text: '你结识了许多志同道合的朋友，并学到了实战技巧。', statChanges: { gold: -20, social: 2, physical: 1 } },
        partial: { text: '你加入了社团，但由于时间冲突，参加活动的机会不多。', statChanges: { gold: -20, social: 1, physical: 0 } }
      },
      {
        text: '只是去围观一下',
        baseSuccessRate: 1.0,
        success: { text: '你观察了他们的决斗方式，也有所收获。', statChanges: { intelligence: 1 } },
        partial: { text: '围观的人太多，你只看清了几个基础动作。', statChanges: { intelligence: 0 } }
      }
    ]
  },
  {
    id: 'mysterious_merchant',
    type: 'opportunity',
    interactionType: 'decision',
    title: '神秘商人',
    description: '你在深夜的走廊遇到一个披着斗篷的商人，他向你展示了一块闪烁着幽光的宝石。',
    context: 'any',
    relatedStats: ['magic'],
    options: [
      {
        text: '用 100 金币买下宝石',
        baseSuccessRate: 1.0,
        success: { text: '宝石蕴含着纯净的魔力，对你的修行大有裨益。', statChanges: { gold: -100, magic: 2 } },
        partial: { text: '宝石的能量有些驳杂，需要花费时间净化。', statChanges: { gold: -100, magic: 1, stamina: -10 } }
      },
      {
        text: '尝试鉴定宝石的真伪',
        baseSuccessRate: 0.60,
        success: { text: '你识破了这只是一块涂了荧光粉的石头，商人尴尬地溜走了。', statChanges: { intelligence: 1, knowledge: 1 } },
        partial: { text: '你看出宝石有些瑕疵，商人见状主动降了价。', statChanges: { intelligence: 0, gold: -20, magic: 1 } },
        fail: { text: '你被商人的花言巧语迷惑了，白白浪费了时间。', statChanges: { stamina: -10, intelligence: -1 } }
      }
    ]
  },
  {
    id: 'tutor_request',
    type: 'opportunity',
    interactionType: 'decision',
    title: '补课请求',
    description: '一名低年级学生在符文课后拉住你，希望你能帮他讲解一下基础逻辑，他愿意付一点报酬。',
    context: 'study',
    relatedStats: ['social'],
    options: [
      {
        text: '耐心地教导他',
        baseSuccessRate: 0.80,
        success: { text: '他很快就听懂了，并给了你一些金币作为感谢。', statChanges: { gold: 10, social: 1, intelligence: 1 } },
        partial: { text: '他似懂非懂，只给了你一半的报酬。', statChanges: { gold: 5, social: 1 } },
        fail: { text: '你讲得太深奥了，他听得云里雾里，最后只给了你 2 金币。', statChanges: { gold: 2, social: 0, stamina: -5 } }
      },
      {
        text: '推荐他去图书馆自学',
        baseSuccessRate: 1.0,
        success: { text: '你节省了时间，但也错过了一个交友的机会。', statChanges: { stamina: 2 } },
        partial: { text: '你指出了几本参考书，他感激地离开了。', statChanges: { social: 1 } }
      }
    ]
  },
  {
    id: 'garden_treasure',
    type: 'opportunity',
    interactionType: 'decision',
    title: '花园奇遇',
    description: '你在学院花园的角落发现了一株罕见的魔法植物，它似乎正处于成熟期。',
    context: 'any',
    relatedStats: ['knowledge'],
    options: [
      {
        text: '尝试完整地采摘它',
        baseSuccessRate: 0.50,
        success: { text: '你成功采摘到了完美的样本，这能卖个好价钱。', statChanges: { gold: 60, knowledge: 2 } },
        partial: { text: '采摘过程中叶片受损，价值大打折扣。', statChanges: { gold: 20, knowledge: 1 } },
        fail: { text: '你不小心弄坏了它的根茎，药效全失。', statChanges: { knowledge: 1 } }
      },
      {
        text: '只是记录它的生长习性',
        baseSuccessRate: 1.0,
        success: { text: '你的研究笔记又丰富了。', statChanges: { knowledge: 3 } },
        partial: { text: '你画下了它的草图，虽然不够详尽。', statChanges: { knowledge: 1 } }
      }
    ]
  }
];

const GLOBAL_SAFE_KEYWORDS = ['观察', '求助', '隔离', '缓慢', '小心', '测试', '请教', '准备', '稳住', '后退'];
const GLOBAL_RISKY_KEYWORDS = ['强行', '硬来', '直接', '暴力', '快速', '冲', '乱碰', '破坏', '撞', '抢'];

// ==========================================
// 3. 辅助函数与 AI 基础层
// ==========================================

/**
 * 统一的 AI 文本生成基础层
 * 严禁参与任何数值计算、逻辑判定或状态推进
 */
const askAI = async (params: {
  message: string;
  systemPrompt: string;
  history?: any[];
  fallback?: string;
  jsonMode?: boolean;
}) => {
  const { 
    message, 
    systemPrompt, 
    history, 
    fallback = "（由于学院魔力波动，暂时无法生成详细描述）",
    jsonMode = false
  } = params;

  try {
    // 每次调用创建新实例，确保使用最新的 API Key
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // 构造内容
    // 如果有历史记录，则使用历史记录格式；否则使用简单字符串
    const contents = history ? history : message;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.8,
        topP: 0.95,
        responseMimeType: jsonMode ? "application/json" : "text/plain",
      },
    });

    return response.text || fallback;
  } catch (error) {
    console.error("AI 基础层调用失败:", error);
    return fallback;
  }
};

const calculateCommissionScore = (comm: any, stats: any) => {
  return comm.requirements.reduce((acc: number, req: any) => {
    const playerVal = (stats as any)[req.attrId] || 0;
    const ratio = req.threshold > 0 ? playerVal / req.threshold : 1;
    return acc + ratio * req.weight;
  }, 0);
};

const generateCommissions = (week: number, currentStats: any) => {
  const pool: any[] = [];
  const count = 6; // 固定生成6个，方便管理

  const createOneCommission = (forceAcceptable = false) => {
    const rand = Math.random() * (week / 10 + 1);
    let gradeIdx = 0;
    if (rand > 3.5) gradeIdx = 5;
    else if (rand > 2.5) gradeIdx = 4;
    else if (rand > 1.8) gradeIdx = 3;
    else if (rand > 1.2) gradeIdx = 2;
    else if (rand > 0.6) gradeIdx = 1;
    
    // 如果强制可接，且当前周数较高，尝试给一个匹配玩家最高属性的高级委托
    if (forceAcceptable) {
      const sortedStats = [...ATTRIBUTES].sort((a, b) => (currentStats as any)[b.id] - (currentStats as any)[a.id]);
      const bestAttr = sortedStats[0];
      const bestVal = (currentStats as any)[bestAttr.id];
      // 寻找最接近玩家最高属性的等级
      gradeIdx = COMMISSION_GRADES.findIndex(g => g.threshold > bestVal) - 1;
      if (gradeIdx < 0) gradeIdx = 0;
      if (gradeIdx > 5) gradeIdx = 5;
    }

    const gradeInfo = COMMISSION_GRADES[gradeIdx];
    
    // 确定属性数量
    let attrCount = 1;
    if (gradeInfo.grade === 'E') attrCount = Math.random() > 0.5 ? 2 : 1;
    else if (gradeInfo.grade === 'D') attrCount = 2;
    else if (gradeInfo.grade === 'C') attrCount = Math.random() > 0.5 ? 3 : 2;
    else if (gradeInfo.grade === 'B') attrCount = 3;
    else if (gradeInfo.grade === 'A') attrCount = Math.random() > 0.5 ? 4 : 3;

    // 随机选择属性
    const shuffledAttrs = [...ATTRIBUTES].sort(() => Math.random() - 0.5);
    const selectedAttrs = shuffledAttrs.slice(0, attrCount);
    
    // 分配权重
    const weights = attrCount === 1 ? [1] : 
                   attrCount === 2 ? [0.7, 0.3] :
                   attrCount === 3 ? [0.6, 0.2, 0.2] : [0.5, 0.2, 0.15, 0.15];

    const requirements = selectedAttrs.map((attr, i) => {
      let threshold = i === 0 ? gradeInfo.threshold : Math.floor(gradeInfo.threshold * (0.6 + Math.random() * 0.2));
      
      // 如果强制可接，微调门槛
      if (forceAcceptable) {
        const pVal = (currentStats as any)[attr.id];
        if (threshold > pVal) threshold = Math.max(0, Math.floor(pVal * 0.9));
      }

      return {
        attrId: attr.id,
        attrName: attr.name,
        threshold,
        weight: weights[i]
      };
    });

    return {
      id: Math.random().toString(36).substr(2, 9),
      grade: gradeInfo.grade,
      requirements,
      costSlots: gradeInfo.costSlots,
      reward: Math.floor(gradeInfo.goldMin + Math.random() * (gradeInfo.goldMax - gradeInfo.goldMin)),
      rewardRange: [gradeInfo.goldMin, gradeInfo.goldMax],
      title: `${selectedAttrs[0].name}相关委托`,
      issuer: "学院教务处",
      description: `协助处理有关${selectedAttrs[0].name}的日常事务。`,
      atmosphere: "平淡无奇的日常。",
    };
  };

  // 先生成2个保底可接的
  pool.push(createOneCommission(true));
  pool.push(createOneCommission(true));
  
  // 再生成4个随机的
  for (let i = 0; i < 4; i++) {
    pool.push(createOneCommission(false));
  }

  return pool.sort(() => Math.random() - 0.5);
};

const judgeEnding = (stats: any) => {
  const { knowledge, intelligence, physical, magic, social, inspiration } = stats;
  const all = [knowledge, intelligence, physical, magic, social, inspiration] as number[];
  
  console.log("--- 毕业结算 ---");
  console.log("最终属性:", stats);

  // 1. 魔法核心层候选人：六项属性全部 >= 90
  if (all.every(v => v >= 90)) {
    const res = { title: "魔法核心层候选人", desc: "你成为了学院历史上最耀眼的天才，直接进入了魔法世界的权力核心。" };
    console.log("最终结局:", res.title);
    return res;
  }

  // 2. 专精结局
  // 魔法学者：知识 >= 90 且 魔力 >= 90
  if (knowledge >= 90 && magic >= 90) {
    const res = { title: "魔法学者", desc: "你沉浸在古老的卷轴中，成为了当代最博学的魔法理论大师。" };
    console.log("最终结局:", res.title);
    return res;
  }
  // 战斗法师：体能 >= 90 且 魔力 >= 90
  if (physical >= 90 && magic >= 90) {
    const res = { title: "战斗法师", desc: "你的法术如雷霆般迅猛，成为了战场上最令人畏惧的存在。" };
    console.log("最终结局:", res.title);
    return res;
  }
  // 魔法外交官：社交 >= 90 且 智力 >= 90
  if (social >= 90 && intelligence >= 90) {
    const res = { title: "魔法外交官", desc: "你游走于各国势力之间，用言语和魔法维护着世界的和平。" };
    console.log("最终结局:", res.title);
    return res;
  }
  // 传奇炼金师：灵感 >= 90 且 知识 >= 90
  if (inspiration >= 90 && knowledge >= 90) {
    const res = { title: "传奇炼金师", desc: "你发现了一系列点石成金的秘方，你的名字将被刻在炼金术的历史上。" };
    console.log("最终结局:", res.title);
    return res;
  }

  // 3. 全能毕业生：六项属性全部 >= 70
  if (all.every(v => v >= 70)) {
    const res = { title: "全能毕业生", desc: "你在所有领域都表现出色，是学院引以为傲的优秀毕业生。" };
    console.log("最终结局:", res.title);
    return res;
  }

  // 4. 博士申请资格：任意单属性 >= 70
  if (all.some(v => v >= 70)) {
    const res = { title: "博士申请资格", desc: "你在特定领域展现出了惊人的天赋，具备继续深造的巨大潜力。" };
    console.log("最终结局:", res.title);
    return res;
  }

  // 5. 普通毕业：进入魔法部基层工作
  const res = { title: "普通毕业", desc: "你顺利完成了学业，进入魔法部基层工作，开始了一段平凡但安稳的魔法人生。" };
  console.log("最终结局:", res.title);
  return res;
};

// ==========================================
// 3. 主组件
// ==========================================
export default function App() {
  const [time, setTime] = useState({ year: 1, week: 1, slot: 0 });
  const { year, week, slot: currentSlot } = time;
  const [gold, setGold] = useState(GAME_CONFIG.INITIAL_GOLD);
  const [stamina, setStamina] = useState(GAME_CONFIG.MAX_STAMINA);
  const [isFatigued, setIsFatigued] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [stats, setStats] = useState({ knowledge: 0, intelligence: 0, physical: 0, magic: 0, social: 0, inspiration: 0 });
  const [courseProgress, setCourseProgress] = useState({ knowledge: 0, intelligence: 0, physical: 0, magic: 0, social: 0, inspiration: 0 });
  const [commissions, setCommissions] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>(["欢迎来到魔法学院！开启你的三年求学之旅吧。"]);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const generatingWeekRef = React.useRef({ year: 0, week: 0 });

  // 突发事件状态
  const [recentEventIds, setRecentEventIds] = useState<string[]>([]);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [eventInput, setEventInput] = useState("");
  const [eventOutcome, setEventOutcome] = useState<any | null>(null);
  const [weeklyEventIds, setWeeklyEventIds] = useState<string[]>([]);

  // 每周数据追踪
  const [weeklyData, setWeeklyData] = useState({
    courses: {} as Record<string, number>,
    commissions: 0,
    statsStart: { ...stats },
    goldStart: gold,
  });
  const [showReport, setShowReport] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportWeek, setReportWeek] = useState({ year: 1, week: 1 });

  useEffect(() => { 
    const newComms = generateCommissions(week, stats);
    setCommissions(newComms); 
    // 触发 AI 生成委托文案
    generateCommissionAIContent(newComms, year, week);
  }, [week]);

  const generateCommissionAIContent = async (comms: any[], currentYear: number, currentWeek: number) => {
    try {
      const systemPrompt = `你是一个魔法学院的委托发布系统。
你的任务是为一组已确定的委托生成生动的背景文案。
风格：奇幻、神秘、魔法感，严禁现代词汇。
输出格式：必须是严格的 JSON 对象，包含一个字段 "commissions"，它是一个数组，长度必须与输入一致。
每个对象包含：
1. id: (保持输入中的 id 不变)
2. title: 吸引人的标题 (4-8字)
3. issuer: 发布者身份 (如：炼金术教授、禁林守林人、神秘的黑市商人)
4. description: 简短的任务简介 (15-30字)
5. atmosphere: 一句氛围描述 (可选，10字以内)
语言：中文。`;

      const commsData = comms.map(c => ({
        id: c.id,
        grade: c.grade,
        requirements: c.requirements.map((r: any) => `${r.attrName} >= ${r.threshold}`).join(', '),
        reward: c.reward,
        costSlots: c.costSlots
      }));

      const message = `学年：第 ${currentYear} 学年，第 ${currentWeek} 周
委托列表：${JSON.stringify(commsData)}`;

      const result = await askAI({
        message,
        systemPrompt,
        fallback: "FALLBACK",
        jsonMode: true
      });

      if (result !== "FALLBACK") {
        try {
          let parsed;
          try {
            parsed = JSON.parse(result);
          } catch (e) {
            const jsonStr = result.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(jsonStr);
          }

          if (parsed.commissions && Array.isArray(parsed.commissions)) {
            setCommissions(prev => {
              // 只有当 ID 匹配时才更新，防止异步覆盖
              const updated = prev.map(c => {
                const aiContent = parsed.commissions.find((ac: any) => ac.id === c.id);
                if (aiContent) {
                  return {
                    ...c,
                    title: aiContent.title || c.title,
                    issuer: aiContent.issuer || c.issuer,
                    description: aiContent.description || c.description,
                    atmosphere: aiContent.atmosphere || c.atmosphere
                  };
                }
                return c;
              });
              return updated;
            });
          }
        } catch (e) {
          console.error("解析 AI 委托文案失败:", e);
        }
      }
    } catch (e) {
      console.error("生成 AI 委托文案失败:", e);
    }
  };

  // 每周结束触发周报
  const prevWeekRef = React.useRef(week);
  useEffect(() => {
    if (week !== prevWeekRef.current) {
      // 记录是哪一周的周报（即刚刚结束的那一周）
      const finishedYear = prevWeekRef.current === GAME_CONFIG.WEEKS_PER_YEAR ? year - 1 : year;
      const finishedWeek = prevWeekRef.current;
      setReportWeek({ year: finishedYear, week: finishedWeek });
      
      // 触发 AI 生成周报
      generateWeeklyReport(weeklyData, stats, gold, finishedYear, finishedWeek);
      
      // 重置本周数据
      setWeeklyData({
        courses: {},
        commissions: 0,
        statsStart: { ...stats },
        goldStart: gold,
      });
      setWeeklyEventIds([]);
    }
    prevWeekRef.current = week;
  }, [week]);

  const triggerRandomEvent = (context: 'study' | 'commission' | 'any') => {
    // 每周事件数量控制：至少1个，最多2个
    const currentCount = weeklyEventIds.length;
    
    // 如果本周还没触发过事件，第一项活动 100% 触发 (保证至少1个)
    // 如果已经触发过1个，后续活动 50% 概率触发 (最多2个)
    // 如果已经触发过2个，不再触发
    let triggerProb = 0;
    if (currentCount === 0) {
      triggerProb = 1.0; 
    } else if (currentCount === 1) {
      triggerProb = 0.5;
    } else {
      return;
    }

    if (Math.random() > triggerProb) return;

    // 1. 过滤可选事件
    let availableEvents = RANDOM_EVENTS.filter(ev => {
      // 匹配上下文
      const contextMatch = ev.context === 'any' || ev.context === context;
      // 本周未触发过
      const notThisWeek = !weeklyEventIds.includes(ev.id);
      return contextMatch && notThisWeek;
    });

    if (availableEvents.length === 0) return;

    // 2. 优先选择不在最近历史中的事件
    const freshEvents = availableEvents.filter(ev => !recentEventIds.includes(ev.id));
    const pool = freshEvents.length > 0 ? freshEvents : availableEvents;

    // 3. 随机选择一个
    const selectedEvent = pool[Math.floor(Math.random() * pool.length)];
    
    setActiveEvent(selectedEvent);
    setWeeklyEventIds(prev => [...prev, selectedEvent.id]);
    setRecentEventIds(prev => {
      const next = [selectedEvent.id, ...prev].slice(0, 10); // 保留最近10个
      return next;
    });

    // 如果是即时事件，直接生成结果
    if (selectedEvent.interactionType === 'instant') {
      const outcome = {
        ...selectedEvent.outcome,
        text: `${selectedEvent.description}\n\n${selectedEvent.outcome.text}`,
        type: selectedEvent.type === 'inspiration' ? 'success' : 'partial',
        reason: selectedEvent.type === 'inspiration' ? '这是一次难得的灵感迸发！' : '生活中的小确幸。'
      };
      setEventOutcome(outcome);
      
      // 应用数值变化
      if (outcome.statChanges) {
        Object.entries(outcome.statChanges).forEach(([key, val]) => {
          if (key === 'gold') setGold(prev => Math.max(0, prev + (val as number)));
          else if (key === 'stamina') setStamina(prev => Math.min(GAME_CONFIG.MAX_STAMINA, Math.max(0, prev + (val as number))));
          else gainStat(key, val as number);
        });
      }
      addLog(`[突发事件] ${selectedEvent.title}：${selectedEvent.outcome.text}`);
    }
  };

  const handleEventChoice = () => {
    if (!activeEvent) return;

    // 1. 判定模式：固定选项 vs 自由输入
    if (selectedOptionIdx !== null) {
      // --- 固定选项逻辑 (三档结果判定) ---
      const option = activeEvent.options[selectedOptionIdx];
      const relatedStatId = activeEvent.relatedStats ? activeEvent.relatedStats[0] : 'intelligence';
      const playerVal = (stats as any)[relatedStatId] || 0;
      
      // 确定基础概率分布
      let baseProbs = { success: 0.35, partial: 0.35, failure: 0.30 }; // 默认普通
      if (option.baseSuccessRate >= 0.7) {
        baseProbs = { success: 0.45, partial: 0.35, failure: 0.20 }; // 稳妥
      } else if (option.baseSuccessRate < 0.5) {
        baseProbs = { success: 0.25, partial: 0.35, failure: 0.40 }; // 冒险
      }

      // 属性修正 (最大总修正 10%)
      const bonus = Math.min(0.1, playerVal / 2000); // 2000点达到满修正
      const successProb = baseProbs.success + bonus;
      const failureProb = baseProbs.failure - bonus;
      const partialProb = baseProbs.partial; // 保持中间档稳定

      const roll = Math.random();
      let resultType: 'success' | 'partial' | 'failure';
      if (roll < successProb) resultType = 'success';
      else if (roll < successProb + partialProb) resultType = 'partial';
      else resultType = 'failure';
      
      const outcome = option[resultType] || (resultType === 'partial' ? option.success : option.fail);
      
      setEventOutcome({
        ...outcome,
        type: resultType,
        reason: resultType === 'success' 
          ? `你的处理方案非常出色。（成功率：${(successProb * 100).toFixed(0)}%）` 
          : resultType === 'partial'
          ? `处理过程略显波折，但结果尚可。（概率：${(partialProb * 100).toFixed(0)}%）`
          : `运气欠佳，事态向不利方向发展。（失败率：${(failureProb * 100).toFixed(0)}%）`
      });

      if (outcome.statChanges) {
        Object.entries(outcome.statChanges).forEach(([key, val]) => {
          if (key === 'gold') setGold(prev => Math.max(0, prev + (val as number)));
          else if (key === 'stamina') setStamina(prev => Math.min(GAME_CONFIG.MAX_STAMINA, Math.max(0, prev + (val as number))));
          else gainStat(key, val as number);
        });
      }
      addLog(`[突发事件] ${activeEvent.title}：${outcome.text}`);
    } else {
      // --- 自由输入逻辑 (三档结果判定) ---
      const input = eventInput.trim();
      if (input.length < 4) {
        alert("请输入更具体的处理方式（至少4个字）。");
        return;
      }

      // A. 文本策略修正
      let strategyBonus = 0;
      if (activeEvent.goodApproaches) {
        activeEvent.goodApproaches.forEach((k: string) => { if (input.includes(k)) strategyBonus += 0.05; });
      }
      if (activeEvent.badApproaches) {
        activeEvent.badApproaches.forEach((k: string) => { if (input.includes(k)) strategyBonus -= 0.05; });
      }

      // B. 属性修正
      let abilityBonus = 0;
      if (activeEvent.relatedStats) {
        activeEvent.relatedStats.forEach((s: string) => { 
          abilityBonus += ((stats as any)[s] || 0) / 4000; 
        });
        abilityBonus = abilityBonus / activeEvent.relatedStats.length;
      }

      // C. 关键词风险修正
      let riskBonus = 0;
      GLOBAL_SAFE_KEYWORDS.forEach(k => { if (input.includes(k)) riskBonus += 0.02; });
      GLOBAL_RISKY_KEYWORDS.forEach(k => { if (input.includes(k)) riskBonus -= 0.02; });

      // 总修正限制在 10%
      const totalBonus = Math.min(0.1, Math.max(-0.1, strategyBonus + abilityBonus + riskBonus));

      // 基础概率：成功 30%, 部分成功 40%, 失败 30%
      const successProb = 0.30 + totalBonus;
      const failureProb = 0.30 - totalBonus;
      const partialProb = 0.40;

      const roll = Math.random();
      let type: 'success' | 'partial' | 'failure' = 'failure';
      if (roll < successProb) type = 'success';
      else if (roll < successProb + partialProb) type = 'partial';
      else type = 'failure';

      let text = "";
      let reason = "";
      let statChanges: any = {};

      const mainStat = activeEvent.relatedStats ? activeEvent.relatedStats[0] : 'intelligence';

      if (type === 'success') {
        text = "你的处理方案非常精妙，完美化解了危机！";
        reason = `你的思路（${input.slice(0, 10)}...）与事态高度契合。`;
        statChanges = { [mainStat]: 1, inspiration: 1 };
      } else if (type === 'partial') {
        text = "你的尝试产生了一些效果，最终勉强平息了事态。";
        reason = "方案基本合理，但细节处理略显粗糙。";
        statChanges = { [mainStat]: 0, stamina: -2 };
      } else {
        text = "你的应对方式似乎并不奏效，甚至引发了反效果。";
        reason = "方案未能触及核心问题，或者运气实在太差。";
        statChanges = { [mainStat]: -1, stamina: -5 };
      }

      setEventOutcome({ type, text, reason, statChanges, userInput: input });

      Object.entries(statChanges).forEach(([key, val]) => {
        if (key === 'gold') setGold(prev => Math.max(0, prev + (val as number)));
        else if (key === 'stamina') setStamina(prev => Math.min(GAME_CONFIG.MAX_STAMINA, Math.max(0, prev + (val as number))));
        else gainStat(key, val as number);
      });

      addLog(`[突发事件] ${activeEvent.title}：${text}`);
    }
  };

  const generateWeeklyReport = (data: any, currentStats: any, currentGold: any, reportYear: number, reportWeekNum: number) => {
    setIsGeneratingReport(true);
    setShowReport(true);
    generatingWeekRef.current = { year: reportYear, week: reportWeekNum };

    const statGrowth = Object.keys(currentStats).reduce((acc: any, key) => {
      const growth = (currentStats as any)[key] - data.statsStart[key];
      if (growth > 0) acc[key] = growth;
      return acc;
    }, {});

    const courseSummaryInput = Object.entries(data.courses)
      .map(([name, count]) => `${name} x ${count}`)
      .join('，');

    const statSummaryInput = Object.entries(statGrowth)
      .map(([k, v]) => `${ATTRIBUTES.find(a => a.id === k)?.name} +${v}`)
      .join('，');

    const localCourseSummary = courseSummaryInput ? `本周完成了以下课程的学习：${courseSummaryInput}。` : "本周未进行任何正式课程登记。";
    const localWeeklySummary = `本周你完成了 ${data.commissions} 个委托，金币变化 ${currentGold - data.goldStart}。属性提升：${statSummaryInput || '无'}。整体进展稳定。`;
    const randomComment = REPORT_COMMENT_TEMPLATES[Math.floor(Math.random() * REPORT_COMMENT_TEMPLATES.length)];

    const buildReport = (courseSum: string, weeklySum: string) => `【魔法学院 · 教务处周报】

致：第 ${reportYear} 学年学生

本周你的学习记录如下：
${courseSum}

——

本周总体情况：
${weeklySum}

——

教务处评语：
${randomComment}`;

    // 立即显示本地周报
    setReportContent(buildReport(localCourseSummary, localWeeklySummary));

    // 后台异步调用 AI
    (async () => {
      try {
        const systemPrompt = `你是一个魔法学院教务处的自动化记录仪。
你的任务是根据数据生成周报的两个特定部分。
风格：冷静描述，略带黑色幽默，严禁现代词汇。
输出格式：必须是严格的 JSON 对象，包含以下字段：
1. course_summary: 针对本周上过的课程（最多3门），每门生成1句具体的魔法描述。
2. weekly_summary: 总结委托、金币、体力、属性变化，2-3句话，简洁有力。
语言：中文。`;

        const message = `学年：第 ${reportYear} 学年，第 ${reportWeekNum} 周
课程记录：${courseSummaryInput || '无'}
完成委托：${data.commissions} 个
属性提升：${statSummaryInput || '无'}
金币变化：${currentGold - data.goldStart}
当前体力：${stamina}`;

        const result = await askAI({
          message,
          systemPrompt,
          fallback: "FALLBACK",
          jsonMode: true
        });

        // 检查是否仍然是当前正在生成的周，防止过时请求覆盖新数据
        if (generatingWeekRef.current.year === reportYear && generatingWeekRef.current.week === reportWeekNum) {
          if (result !== "FALLBACK") {
            try {
              // 尝试直接解析 JSON，如果失败则尝试清理后再解析
              let parsed;
              try {
                parsed = JSON.parse(result);
              } catch (e) {
                const jsonStr = result.replace(/```json|```/g, '').trim();
                parsed = JSON.parse(jsonStr);
              }

              if (parsed.course_summary || parsed.weekly_summary) {
                setReportContent(buildReport(
                  parsed.course_summary || localCourseSummary,
                  parsed.weekly_summary || localWeeklySummary
                ));
              }
            } catch (e) {
              console.error("解析 AI 周报 JSON 失败:", e);
            }
          }
          setIsGeneratingReport(false);
        }
      } catch (e) {
        console.error("后台生成 AI 周报失败:", e);
        if (generatingWeekRef.current.year === reportYear && generatingWeekRef.current.week === reportWeekNum) {
          setIsGeneratingReport(false);
        }
      }
    })();
  };

  const totalWeeks = (year - 1) * GAME_CONFIG.WEEKS_PER_YEAR + week;
  const maxTotalWeeks = GAME_CONFIG.MAX_YEAR * GAME_CONFIG.WEEKS_PER_YEAR;
  const currentDay = Math.floor(currentSlot / 2) + 1;
  const isAfternoon = currentSlot % 2 === 1;
  const slotsLeft = 10 - currentSlot;

  const addLog = (msg: string) => { setLogs(prev => [msg, ...prev].slice(0, 50)); };

  const nextSlot = (count = 1) => {
    if (isGameOver) return;

    setTime(prev => {
      let newSlot = prev.slot + count;
      let newWeek = prev.week;
      let newYear = prev.year;

      // 疲劳惩罚：如果疲劳且进行上午行动，则跳过下午
      if (isFatigued && count === 1 && prev.slot % 2 === 0) {
        newSlot = prev.slot + 2;
      }

      if (newSlot >= 10) {
        newSlot = 0;
        newWeek += 1;
        
        if (newWeek > GAME_CONFIG.WEEKS_PER_YEAR) {
          newWeek = 1;
          newYear += 1;
          
          if (newYear > GAME_CONFIG.MAX_YEAR) {
            console.log(`时间更新 → 第 ${newYear} 学年, 第 1 周 (触发毕业)`);
          } else {
            console.log(`时间更新 → 第 ${newYear} 学年, 第 1 周`);
            addLog(`--- 第 ${prev.year} 学年 第 ${prev.week} 周结束 ---`);
            addLog(`新的一周开始了，进入第 ${newYear} 学年。`);
          }
        } else {
          console.log(`时间更新 → 第 ${newYear} 学年, 第 ${newWeek} 周`);
          addLog(`--- 第 ${newYear} 学年 第 ${prev.week} 周结束 ---`);
          addLog(`新的一周开始了。`);
        }
      }

      return { year: newYear, week: newWeek, slot: newSlot };
    });
  };

  useEffect(() => {
    if (year > GAME_CONFIG.MAX_YEAR) {
      setIsGameOver(true);
    }
  }, [year]);

  const gainStat = (id: string, amount: number) => {
    setStats(prev => {
      const currentVal = (prev as any)[id];
      if (currentVal >= GAME_CONFIG.ATTR_ADVANCED_THRESHOLD && amount < 5) {
        addLog(`提示：${ATTRIBUTES.find(a => a.id === id)?.name}已达瓶颈，需高级课程。`);
        return prev;
      }
      return { ...prev, [id]: Math.min(GAME_CONFIG.ATTR_MAX, currentVal + amount) };
    });
  };

  const handleStudy = async (attrId: string) => {
    const progress = (courseProgress as any)[attrId];
    let level = 'PRIMARY';
    if (progress >= GAME_CONFIG.LEVEL_UP_COUNT * 2) level = 'ADVANCED';
    else if (progress >= GAME_CONFIG.LEVEL_UP_COUNT) level = 'INTERMEDIATE';
    const config = (COURSE_LEVELS as any)[level];
    if (gold < config.cost) { addLog("金币不足！"); return; }
    
    const attrInfo = ATTRIBUTES.find(a => a.id === attrId);
    const levelName = level === 'PRIMARY' ? '初级' : level === 'INTERMEDIATE' ? '中级' : '高级';

    setGold(prev => prev - config.cost);
    setCourseProgress(prev => ({ ...prev, [attrId]: progress + 1 }));
    gainStat(attrId, config.gain);
    setStamina(prev => {
      const next = Math.max(0, prev - 5);
      if (next <= GAME_CONFIG.FATIGUE_THRESHOLD) setIsFatigued(true);
      return next;
    });
    
    addLog(`参加了${attrInfo?.courseName}（${levelName}），金币-${config.cost}，${attrInfo?.name}+${config.gain}`);
    
    // 记录每周数据
    setWeeklyData(prev => ({
      ...prev,
      courses: {
        ...prev.courses,
        [attrInfo?.courseName || '']: (prev.courses[attrInfo?.courseName || ''] || 0) + 1
      }
    }));

    nextSlot();
    triggerRandomEvent('study');

    // 本地课堂反馈
    const templates = COURSE_FEEDBACK_TEMPLATES[attrId] || [];
    const feedback = templates[Math.floor(Math.random() * templates.length)] || `你在${attrInfo?.courseName}上表现认真，${attrInfo?.name}获得了提升。`;
    addLog(`[课堂反馈] ${feedback}`);
  };

  const handleRest = () => {
    setStamina(prev => {
      const next = Math.min(GAME_CONFIG.MAX_STAMINA, prev + GAME_CONFIG.STAMINA_REST);
      if (next >= GAME_CONFIG.RECOVERY_THRESHOLD) setIsFatigued(false);
      return next;
    });
    addLog("休息恢复了体力。");
    nextSlot();
  };

  const handleCommission = (comm: any) => {
    const score = calculateCommissionScore(comm, stats);
    if (score < 1) { 
      const bottleneck = comm.requirements.sort((a: any, b: any) => {
        const ratioA = (stats as any)[a.attrId] / a.threshold;
        const ratioB = (stats as any)[b.attrId] / b.threshold;
        return ratioA - ratioB;
      })[0];
      addLog(`能力不足！综合评分：${(score * 100).toFixed(0)}%，主要缺口：${bottleneck.attrName}。`); 
      return; 
    }
    if (stamina < GAME_CONFIG.STAMINA_COMMISSION_BASE) { addLog("体力不足！"); return; }
    if (slotsLeft < comm.costSlots) { addLog("时间不足！"); return; }
    setGold(prev => prev + comm.reward);
    setStamina(prev => {
      const next = Math.max(0, prev - GAME_CONFIG.STAMINA_COMMISSION_BASE);
      if (next <= GAME_CONFIG.FATIGUE_THRESHOLD) setIsFatigued(true);
      return next;
    });
    setCommissions(prev => prev.filter(c => c.id !== comm.id));
    addLog(`完成委托：${comm.title}，金币+${comm.reward}`);
    
    // 记录每周数据
    setWeeklyData(prev => ({ ...prev, commissions: prev.commissions + 1 }));

    nextSlot(comm.costSlots);
    triggerRandomEvent('commission');
  };

  // --- 决策辅助逻辑 ---
  const statusHints = useMemo(() => {
    const hints = [];
    
    // 体力
    if (stamina <= 30) hints.push({ icon: <Zap className="w-3 h-3" />, text: "体力储备较低，注意疲劳风险。", color: "text-red-400" });
    else if (stamina <= 50) hints.push({ icon: <Zap className="w-3 h-3" />, text: "体力消耗过半，建议适度休息。", color: "text-yellow-400" });
    
    // 金币
    if (gold < 50) hints.push({ icon: <Wallet className="w-3 h-3" />, text: "金币储备紧张，建议关注委托。", color: "text-red-400" });
    
    // 学年节奏
    if (year === 1) hints.push({ icon: <TrendingUp className="w-3 h-3" />, text: "第一学年：打好基础，探索各门课程。", color: "text-blue-400" });
    else if (year === 2) hints.push({ icon: <TrendingUp className="w-3 h-3" />, text: "第二学年：稳步提升，积累金币。", color: "text-purple-400" });
    else if (year === 3) hints.push({ icon: <TrendingUp className="w-3 h-3" />, text: "第三学年：最后冲刺，完善自身能力。", color: "text-orange-400" });

    // 属性平衡
    const values = Object.values(stats) as number[];
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (max - min > 40) hints.push({ icon: <Info className="w-3 h-3" />, text: "属性分布较为集中，注意全面发展或深耕优势。", color: "text-indigo-400" });

    return hints;
  }, [stamina, gold, year, stats]);

  const ending = useMemo(() => isGameOver ? judgeEnding(stats) : null, [isGameOver, stats]);

  return (
    <div className="h-screen bg-[#1a1612] text-[#e0d5c0] font-sans flex flex-col overflow-hidden selection:bg-[#c5a059] selection:text-black">
      {/* 顶部固定状态栏 */}
      <header className="shrink-0 bg-[#2a241d] border-b-2 border-[#8b7355] shadow-xl z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <Calendar className="w-6 h-6 text-[#c5a059]" />
              <span className="font-bold text-3xl tracking-tighter text-white">第 {year} 学年 第 {week} 周</span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`px-3 py-1 rounded text-base font-black uppercase tracking-widest ${isAfternoon ? 'bg-orange-900/60 text-orange-200' : 'bg-blue-900/60 text-blue-200'}`}>
                {isAfternoon ? '下午' : '上午'}
              </span>
              <div className="flex flex-col">
                <span className="text-base font-bold text-[#c5a059]">周{['一', '二', '三', '四', '五'][currentDay - 1]}</span>
                <span className="text-xs opacity-50 uppercase tracking-widest">剩余时间: {slotsLeft}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-16">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/10 rounded-full border border-yellow-500/20">
                <Coins className="w-6 h-6 text-yellow-500" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-black text-yellow-400 leading-none">{gold}</span>
                <span className="text-xs opacity-50 uppercase tracking-widest">金币余额</span>
              </div>
            </div>
            
            <div className="flex flex-col w-64">
              <div className="flex justify-between items-end mb-1">
                <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest">
                  <Battery className={`w-4 h-4 ${stamina <= 20 ? 'text-red-500 animate-pulse' : 'text-green-500'}`} />
                  体力
                </span>
                <span className="font-mono font-bold text-base">{stamina} / 100</span>
              </div>
              <div className="h-3 bg-black/60 rounded-full overflow-hidden border border-[#8b7355]/30 p-0.5">
                <motion.div 
                  className={`h-full rounded-full ${stamina <= 20 ? 'bg-gradient-to-r from-red-600 to-red-400' : 'bg-gradient-to-r from-green-600 to-green-400'}`} 
                  animate={{ width: `${stamina}%` }} 
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 主体三栏布局 - 强制桌面端布局 */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-6 grid grid-cols-12 gap-6 overflow-hidden">
        
        {/* 左侧：属性与状态 */}
        <section className="col-span-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
          <div className="bg-[#2a241d] border-2 border-[#8b7355] rounded-xl p-4 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#c5a059]/5 rounded-full -mr-12 -mt-12 blur-3xl group-hover:bg-[#c5a059]/10 transition-colors" />
            <h3 className="text-[#c5a059] font-black mb-4 flex items-center gap-2 border-b border-[#8b7355]/30 pb-2 uppercase tracking-tighter text-xl">
              <ScrollText className="w-5 h-5" /> 角色属性
            </h3>
            <div className="space-y-4">
              {ATTRIBUTES.map(attr => {
                const val = (stats as any)[attr.id];
                return (
                  <div key={attr.id} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg ${attr.color} text-white shadow-lg`}>{attr.icon}</span>
                        <span className="text-sm font-bold tracking-tight">{attr.name}</span>
                      </div>
                      <span className="font-mono font-bold text-lg text-white">{val}</span>
                    </div>
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden p-0.5">
                      <motion.div className={`h-full rounded-full ${attr.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} animate={{ width: `${val}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[#2a241d] border-2 border-[#8b7355] rounded-xl p-4 shadow-2xl">
            <h3 className="text-[#c5a059] font-black mb-3 flex items-center gap-2 uppercase tracking-tighter text-xl">
              <Info className="w-5 h-5" /> 每周见解
            </h3>
            <div className="space-y-3">
              {statusHints.length > 0 ? statusHints.map((hint, i) => (
                <div key={i} className="flex items-start gap-2 text-sm leading-relaxed p-2 bg-black/20 rounded-lg border border-[#8b7355]/10">
                  <span className={`mt-0.5 shrink-0 ${hint.color}`}>{hint.icon}</span>
                  <span className="opacity-90 font-medium">{hint.text}</span>
                </div>
              )) : (
                <div className="text-sm opacity-40 italic text-center py-2">一切正常。</div>
              )}
            </div>
          </div>
        </section>

        {/* 中间：学院课程 */}
        <section className="col-span-5 flex flex-col bg-[#2a241d] border-2 border-[#8b7355] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-[#8b7355]/30 flex items-center justify-between bg-black/10">
            <h3 className="text-xl font-black text-[#c5a059] flex items-center gap-2 tracking-tighter uppercase">
              学院课程
            </h3>
            <button onClick={handleRest} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4a4035] hover:bg-[#5a4d3f] border-2 border-[#8b7355] rounded-lg transition-all active:scale-95 text-xs font-black uppercase tracking-widest shadow-lg">
              <Coffee className="w-3.5 h-3.5 text-green-500" /> 休息一下
            </button>
          </div>
          
          <div className="flex-1 p-4 space-y-4 overflow-hidden">
            {isFatigued && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-900/40 border-2 border-red-500/50 text-red-100 p-3 rounded-xl flex items-center gap-3 shadow-xl">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <p className="font-bold text-sm">精疲力竭！下午活动已暂停。请立即休息。</p>
              </motion.div>
            )}
            
            <div className="grid grid-cols-2 grid-rows-3 gap-2 h-full">
              {ATTRIBUTES.map(attr => {
                const progress = (courseProgress as any)[attr.id];
                let level = 'PRIMARY';
                if (progress >= GAME_CONFIG.LEVEL_UP_COUNT * 2) level = 'ADVANCED';
                else if (progress >= GAME_CONFIG.LEVEL_UP_COUNT) level = 'INTERMEDIATE';
                const config = (COURSE_LEVELS as any)[level];
                const isAffordable = gold >= config.cost;
                const sessionsToNext = GAME_CONFIG.LEVEL_UP_COUNT - (progress % GAME_CONFIG.LEVEL_UP_COUNT);

                return (
                  <button
                    key={attr.id}
                    onClick={() => handleStudy(attr.id)}
                    disabled={!isAffordable}
                    className={`group relative flex flex-col items-center justify-center p-1.5 rounded-lg border-2 transition-all active:scale-95 shadow-sm h-full
                      ${!isAffordable 
                        ? 'bg-black/40 border-gray-900 opacity-40 cursor-not-allowed' 
                        : 'bg-[#3a3229] border-[#8b7355]/30 hover:border-[#c5a059] hover:bg-[#4a4035]'}`}
                  >
                    <span className={`p-1 rounded-md mb-1 ${attr.color} text-white shadow-md group-hover:scale-110 transition-transform`}>
                      {attr.icon}
                    </span>
                    <span className="text-base font-black tracking-tight mb-0">{(attr as any).courseName}</span>
                    <div className="text-xs flex flex-col items-center opacity-80 space-y-0">
                      <span className="text-[#c5a059] font-black uppercase tracking-widest leading-tight">{level === 'PRIMARY' ? '初级' : level === 'INTERMEDIATE' ? '中级' : '高级'}</span>
                      <span className="font-bold leading-tight">+{config.gain} 点数</span>
                      {level !== 'ADVANCED' && <span className="opacity-50 italic leading-tight">还需: {sessionsToNext} 次</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-yellow-500 font-black text-sm">
                      <Coins className="w-3 h-3" /> {config.cost}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* 右侧：每周委托 */}
        <section className="col-span-4 flex flex-col bg-[#2a241d] border-2 border-[#8b7355] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-[#8b7355]/30 bg-black/10">
            <h3 className="text-xl font-black text-[#c5a059] flex items-center gap-2 tracking-tighter uppercase">
              每周委托
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {commissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 opacity-30">
                <ScrollText className="w-12 h-12 mb-2" />
                <p className="italic font-bold text-sm">本周所有委托已完成。</p>
              </div>
            ) : (
              commissions.map(comm => {
                const score = calculateCommissionScore(comm, stats);
                const hasStamina = stamina >= GAME_CONFIG.STAMINA_COMMISSION_BASE;
                const hasTime = slotsLeft >= comm.costSlots;
                const canAccept = score >= 1 && hasStamina && hasTime;
                
                const sortedReqs = [...comm.requirements].sort((a: any, b: any) => {
                  const ratioA = (stats as any)[a.attrId] / a.threshold;
                  const ratioB = (stats as any)[b.attrId] / b.threshold;
                  return ratioA - ratioB;
                });
                const bottleneck = sortedReqs[0];

                let reason = "";
                if (score < 1) reason = `能力不足 (${(score * 100).toFixed(0)}%) - 需 ${bottleneck.attrName}`;
                else if (!hasStamina) reason = "体力不足";
                else if (!hasTime) reason = "时间不足";

                return (
                  <div key={comm.id} className={`p-2 rounded-lg border-2 transition-all shadow-md ${canAccept ? 'bg-[#3a3229] border-[#8b7355]/40 hover:border-[#c5a059]/50' : 'bg-black/40 border-gray-900 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 flex-1">
                        <div className={`w-7 h-7 rounded flex items-center justify-center font-black text-sm border shadow-inner shrink-0
                          ${comm.grade === 'A' ? 'border-yellow-500 text-yellow-500 bg-yellow-500/10' : 
                            comm.grade === 'B' ? 'border-purple-500 text-purple-500 bg-purple-500/10' :
                            'border-gray-500 text-gray-400 bg-gray-500/5'}`}>
                          {comm.grade}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-black text-base text-white tracking-tight leading-tight truncate">
                            {comm.title}
                          </div>
                          <div className="text-[10px] text-[#c5a059] font-bold opacity-80 mt-0.5">
                            发布人: {comm.issuer}
                          </div>
                          <div className="text-[11px] text-[#e0d5c0] opacity-70 mt-1 line-clamp-2 leading-tight italic">
                            {comm.description}
                          </div>
                          {comm.atmosphere && (
                            <div className="text-[9px] text-orange-500/50 font-bold mt-1 uppercase tracking-widest">
                               {comm.atmosphere}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[10px] font-black px-1 py-0.5 rounded-full uppercase tracking-widest shadow-sm ${score >= 1 ? 'bg-green-900/60 text-green-400' : 'bg-red-900/60 text-red-400'}`}>
                              匹配: {(score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-yellow-500 font-black text-sm flex items-center gap-0.5 ml-2 shrink-0">
                        <Coins className="w-3 h-3" /> {comm.reward}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 mb-2">
                      {comm.requirements.map((req: any) => {
                        const pVal = (stats as any)[req.attrId];
                        const isMet = pVal >= req.threshold;
                        return (
                          <div key={req.attrId} className="flex items-center justify-between bg-black/30 p-1 rounded text-xs border border-[#8b7355]/10">
                            <span className="opacity-60 font-bold truncate mr-1">{req.attrName}</span>
                            <span className={`font-mono font-black ${isMet ? 'text-green-400' : 'text-red-400'}`}>
                              {pVal}/{req.threshold}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#8b7355]/20">
                      <div className="text-xs text-red-400/90 font-bold italic truncate flex-1">
                        {!canAccept && reason}
                      </div>
                      <button 
                        onClick={() => handleCommission(comm)} 
                        disabled={!canAccept} 
                        className={`px-3 py-1 rounded text-xs font-black transition-all shrink-0 shadow-lg uppercase tracking-widest
                          ${canAccept ? 'bg-[#c5a059] text-black hover:bg-[#d9b36a] active:scale-95' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      >
                        {canAccept ? '接取' : '锁定'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* 底部固定日志栏 */}
      <footer className="shrink-0 h-36 bg-[#1a1612] border-t-2 border-[#8b7355] flex overflow-hidden shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="w-56 bg-[#2a241d] border-r-2 border-[#8b7355]/30 flex flex-col items-center justify-center shrink-0 shadow-2xl">
          <ScrollText className="w-8 h-8 text-[#c5a059] mb-1" />
          <h3 className="text-[#c5a059] font-black uppercase tracking-tighter text-xl">学院日志</h3>
          <span className="text-xs opacity-30 uppercase tracking-[0.3em]">编年史</span>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-2.5 custom-scrollbar bg-black/40">
          <AnimatePresence initial={false}>
            {logs.map((log, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                className={`text-sm leading-relaxed flex items-start gap-4 p-2 rounded-lg transition-colors ${i === 0 ? 'bg-[#c5a059]/10 text-white font-bold border-l-4 border-[#c5a059]' : 'opacity-40 hover:opacity-60'}`}
              >
                <span className="text-xs opacity-40 font-mono mt-0.5 shrink-0">[{new Date().toLocaleTimeString('zh-CN', { hour12: false })}]</span>
                <span className="flex-1">{log}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </footer>

      <AnimatePresence>
        {activeEvent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-md w-full bg-[#2a241d] border-2 border-orange-500/50 rounded-2xl p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-orange-500" />
              <h2 className="text-2xl font-black text-orange-400 mb-4 flex items-center gap-2 tracking-tighter uppercase">
                <AlertCircle className="w-6 h-6" /> 突发事件：{activeEvent.title}
              </h2>
              
              <div className="space-y-6">
                {!eventOutcome ? (
                  <>
                    <p className="text-[#e0d5c0] leading-relaxed opacity-90">
                      {activeEvent.description}
                    </p>

                    {activeEvent.interactionType === 'decision' ? (
                      <>
                        <div className="space-y-3">
                          <p className="text-xs font-bold text-orange-500/70 uppercase tracking-widest">方案 A：预设决策</p>
                          {activeEvent.options.map((option: any, idx: number) => {
                            const attr = ATTRIBUTES.find(a => a.id === (activeEvent.relatedStats ? activeEvent.relatedStats[0] : 'intelligence'));
                            const isSelected = selectedOptionIdx === idx;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  setSelectedOptionIdx(idx);
                                  setEventInput(""); // 互斥
                                }}
                                className={`w-full text-left p-4 rounded-xl border-2 transition-all group ${
                                  isSelected 
                                    ? 'bg-orange-500 border-orange-400 text-black shadow-lg scale-[1.02]' 
                                    : 'bg-black/40 border-white/10 text-[#e0d5c0] hover:border-orange-500/50'
                                }`}
                              >
                                <div className="flex justify-between items-start gap-4">
                                  <span className="font-bold leading-tight">{option.text}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-black shrink-0 ${
                                    isSelected ? 'bg-black/20 border-black/20 text-black' : 'bg-orange-500/10 border-orange-500/30 text-orange-500'
                                  }`}>
                                    相关: {attr?.name || '通用'}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-bold text-orange-500/70 uppercase tracking-widest">方案 B：自由应对（关键词判定）</p>
                          <textarea
                            value={eventInput}
                            onChange={(e) => {
                              setEventInput(e.target.value);
                              setSelectedOptionIdx(null); // 互斥
                            }}
                            placeholder="输入你的处理思路，例如：'先观察药液流向，然后尝试用抹布清理'..."
                            className={`w-full bg-black/40 border-2 rounded-xl p-3 text-sm text-[#e0d5c0] outline-none resize-none h-24 transition-all ${
                              eventInput.length > 0 ? 'border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.1)]' : 'border-white/10 focus:border-orange-500/50'
                            }`}
                          />
                          <p className="text-[10px] opacity-40 italic">提示：包含正确关键词（如“观察”、“冥想”）或符合逻辑的动作将提高成功率。</p>
                        </div>

                        <button 
                          onClick={handleEventChoice}
                          disabled={selectedOptionIdx === null && eventInput.trim().length < 4}
                          className={`w-full py-4 font-black text-lg rounded-xl active:scale-95 transition-all shadow-xl uppercase tracking-widest ${
                            (selectedOptionIdx !== null || eventInput.trim().length >= 4)
                              ? 'bg-orange-500 text-black hover:bg-orange-400'
                              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          确认处理
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-sm text-orange-400/80 italic font-bold">这是一个即时发生的事件...</p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className={`p-5 rounded-xl border-2 ${
                      eventOutcome.type === 'success' ? 'bg-green-900/20 border-green-500/30 text-green-200' : 
                      eventOutcome.type === 'partial' ? 'bg-yellow-900/20 border-yellow-500/30 text-yellow-200' :
                      'bg-red-900/20 border-red-500/30 text-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-xs font-black px-2 py-0.5 rounded uppercase ${
                          eventOutcome.type === 'success' ? 'bg-green-500 text-black' : 
                          eventOutcome.type === 'partial' ? 'bg-yellow-500 text-black' :
                          'bg-red-500 text-white'
                        }`}>
                          {eventOutcome.type === 'success' ? '成功' : eventOutcome.type === 'partial' ? '部分成功' : '失败'}
                        </span>
                        <p className="font-bold">{eventOutcome.text}</p>
                      </div>
                      
                      <p className="text-sm opacity-80 mb-4 bg-black/20 p-3 rounded-lg border-l-2 border-current italic">
                        {eventOutcome.reason}
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {Object.entries(eventOutcome.statChanges).map(([key, val]) => {
                          const attr = ATTRIBUTES.find(a => a.id === key);
                          const isPositive = (val as number) > 0;
                          return (
                            <span key={key} className={`text-xs font-black px-2 py-1 rounded-full ${isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                              {key === 'gold' ? '金币' : key === 'stamina' ? '体力' : attr?.name} {isPositive ? '+' : ''}{val as number}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setActiveEvent(null);
                        setEventOutcome(null);
                        setSelectedOptionIdx(null);
                        setEventInput("");
                      }}
                      className="w-full py-4 bg-[#c5a059] text-black font-black text-lg rounded-xl hover:bg-[#d9b36a] active:scale-95 transition-all shadow-xl uppercase tracking-widest"
                    >
                      继续
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReport && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-xl w-full bg-[#2a241d] border-2 border-[#c5a059] rounded-2xl p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-[#c5a059]" />
              <h2 className="text-3xl font-black text-[#c5a059] mb-6 flex items-center gap-3 tracking-tighter uppercase">
                <ScrollText className="w-8 h-8" /> 第 {reportWeek.year} 学年 第 {reportWeek.week} 周报
              </h2>
              
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar pr-2 space-y-6">
                {!reportContent ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                    <Loader2 className="w-10 h-10 animate-spin text-[#c5a059]" />
                    <p className="font-bold text-sm animate-pulse">正在整理教务处记录...</p>
                  </div>
                ) : (
                  <div className="space-y-6 text-[#e0d5c0] leading-relaxed">
                    <div className="prose prose-invert max-w-none">
                      <div className="whitespace-pre-wrap font-medium">
                        {reportContent}
                      </div>
                    </div>
                    {isGeneratingReport && (
                      <div className="flex items-center gap-2 text-xs text-[#c5a059]/60 italic animate-pulse border-t border-[#c5a059]/10 pt-4">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        教务处正在进行魔力润色...
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowReport(false)}
                className="mt-8 w-full py-4 bg-[#c5a059] text-black font-black text-lg rounded-xl hover:bg-[#d9b36a] active:scale-95 transition-all shadow-xl uppercase tracking-widest"
              >
                确认并继续
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 毕业结算弹窗 */}
      <AnimatePresence>
        {isGameOver && ending && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="max-w-2xl w-full bg-[#2a241d] border-4 border-[#c5a059] rounded-3xl p-10 shadow-[0_0_100px_rgba(197,160,89,0.2)] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-transparent via-[#c5a059] to-transparent" />
              
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#c5a059] blur-2xl opacity-20 animate-pulse" />
                  <Trophy className="w-24 h-24 text-[#c5a059] relative z-10" />
                </div>
              </div>

              <h2 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase">毕业典礼</h2>
              <div className="inline-block px-6 py-2 bg-[#c5a059] text-black font-black rounded-full text-xl mb-8 shadow-xl">
                {ending.title}
              </div>
              
              <p className="text-xl text-[#e0d5c0] leading-relaxed mb-10 opacity-90 italic">
                "{ending.desc}"
              </p>

              <div className="grid grid-cols-3 gap-4 mb-10">
                {ATTRIBUTES.map(attr => (
                  <div key={attr.id} className="bg-black/40 p-4 rounded-2xl border border-[#8b7355]/20">
                    <div className="text-[#c5a059] mb-1">{attr.icon}</div>
                    <div className="text-xs opacity-50 font-bold uppercase mb-1">{attr.name}</div>
                    <div className="text-2xl font-black text-white">{(stats as any)[attr.id]}</div>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => window.location.reload()}
                className="w-full py-5 bg-gradient-to-r from-[#c5a059] to-[#d9b36a] text-black font-black text-xl rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_10px_30px_rgba(197,160,89,0.3)] uppercase tracking-widest"
              >
                开启新的旅程
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #8b7355; border-radius: 20px; border: 2px solid rgba(0,0,0,0.2); }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #c5a059; }
      `}</style>
    </div>
  );
}
