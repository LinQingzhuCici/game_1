/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Ghost, ScrollText, Trophy, Play, Save, UserPlus, MessageSquare, CheckCircle2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type GameScreen = 'START' | 'CREATE' | 'OPENING' | 'WELCOME' | 'GAME' | 'SETTLEMENT' | 'ENDING' | 'ACHIEVEMENTS';

interface Achievement {
  id: string;
  name: string;
  description: string;
}

interface Message {
  id: string;
  type: 'info' | 'warning' | 'system'; // blue, yellow, green
  text: string;
}

interface ArchiveEntry {
  source: string;
  text: string;
  is_useful: boolean;
  triggers_mainline?: boolean;
}

interface FollowupEntry {
  question: string;
  answer: string;
}

interface Clue {
  id: string;
  source: string;
  text: string;
}

interface CluePair {
  clue_a_keywords: string[];
  clue_b_keywords: string[];
  contradiction: string;
}

interface Case {
  id: string;
  grade: string;
  name: string;
  age: number;
  cause_of_death: string;
  occupation: string;
  registry_status: string;
  yct_grade: string;
  soul_bio: {
    personality: string;
    known_info: string;
    hidden_info: string;
  };
  questions: { id: string; text: string }[];
  spirit_sense: {
    result: string;
    unlocks_followup: boolean;
  };
  followup: FollowupEntry[];
  compare_clues: string;
  archive: ArchiveEntry[];
  clue_pairs: CluePair[];
  is_mainline?: boolean;
  mainline_trigger?: string;
  verdict: {
    correct: string;
    responses: {
      [key: string]: {
        type: "correct" | "deviation" | "error";
        kpi: number;
        text: string;
      };
    };
  };
}

interface NotebookEntry {
  label: string;
  content: string;
}

interface DialogueTurn {
  id: string;
  type: 'player' | 'soul' | 'system' | 'followup_option' | 'yct';
  text: string;
}

interface CurrentCaseState {
  caseId: string;
  dialogHistory: DialogueTurn[];
  clickedQuestions: string[];
  toolsState: {
    spiritSenseDone: boolean;
    followupDone: boolean;
    compareCluesDone: boolean;
    archiveViewed: boolean;
  };
  followupUnlocked: boolean;
  compareUnlocked: boolean;
  slotA: Clue | null;
  slotB: Clue | null;
  cluePool: Clue[];
  notebook: NotebookEntry[];
  verdictDone: boolean;
}

interface GameState {
  playerName: string;
  level: number;
  stage: string;
  stageKPI: number;
  deathReason?: string;
  currentCase: Case | null;
  dialogue: DialogueTurn[];
  messages: Message[];
  notebook: NotebookEntry[];
  cluePool: Clue[];
  caseQueue: string[];
  achievements: string[];
  stageResults: { case: string; verdict: string; type: string; kpi: number }[];
  toolsStatus: {
    inquiryUsed: boolean;
    spiritSenseUsed: boolean;
    followupActive: boolean;
    followupUsed: boolean;
    usedFollowupIndices: number[];
    usedInquiryIds: string[];
    compareCluesUnlocked: boolean;
    compareCluesFound: boolean;
    archiveViewed: boolean;
    verdictCompleted: boolean;
  };
  currentCaseState?: CurrentCaseState;
  tutorialStep: number;
  totalFreeQuestions: number;
  freeQuestionUnlocked: boolean;
  s_triggered: boolean[];
}

const ACHIEVEMENTS = [
  { id: 'archive_master', name: '最适合归档的人', description: '试用期评估不达标。' },
  { id: 'mediocre', name: '碌碌无为', description: '正式期任意阶段KPI不达标。' },
  { id: 'short_lived', name: '史上最短命的判官', description: '正式期连续3个案件裁决错误。' },
  { id: 'emotionless', name: '毫无感情的裁决机器', description: '游戏通关且所有裁决均为正确。' },
  { id: 'outlaw', name: '法外狂徒', description: '连续3个裁决错误。' },
  { id: 'thorough', name: '刨根问底', description: '单个案件内使用了全部5个调查工具。' },
  { id: 'honest_judge', name: '青天大老爷', description: '同一个询问按钮在同一案件内被点击5次。' },
  { id: 'curious_cat', name: '好奇害死猫', description: '自由提问累计次数超过10次。' },
  { id: 'forbidden_knowledge', name: '不该知道的事', description: '触发了所有S级案件的隐藏真相。' },
  { id: 'bizarre_death', name: '你死得很离奇', description: '死于下载不明软件。' },
  { id: 'old_timer', name: '地府老油条', description: '成功通关第一章。' },
  { id: 'tutorial_complete', name: '判官初成', description: '完成了引导关。' }
];

const DEATH_REASONS = [
  "过于认真地玩手机，走路撞电线杆",
  "因为外卖太烫，心急食热",
  "熬夜追剧，心脏表示拒绝配合",
  "在超市抢最后一包纸巾，过于激动",
  "下载了一个不明软件，连人带手机一起没了"
];

const OPENING_TEXT = `阴曹司法局
实习判官招募通知

由于近年死亡案件积压严重
本部门现向编外人员开放
临时判官职位若干

如您正在阅读此通知
说明您已符合基本条件
——即：您已经死了

请前往B3候审室报道`;

const CASE_POOL: Record<string, Case> = {
  "000": {
    id: "000",
    grade: "C",
    name: "王大柱",
    age: 67,
    cause_of_death: "自然老死",
    occupation: "退休工人",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "老实本分，不善言辞，年轻时脾气急但退休后平和",
      known_info: "工厂干了一辈子，与儿子和解，老伴身体不好，曾在事故中推开同事",
      hidden_info: "年轻时在采购岗位收过一笔回扣，用来给儿子交学费，从未告诉任何人"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你这辈子做过什么让你骄傲的事？" },
      { id: "C", text: "你有没有做过什么亏心事？" },
      { id: "D", text: "你还有什么放不下的？" }
    ],
    spirit_sense: {
      result: "情绪状态：表面平静。在回答C「亏心事」时检测到异常波动：刻意压制的愧疚感。建议：针对此点展开追问。",
      unlocks_followup: true
    },
    followup: [
      { question: "你刚才说的不是全部吧？", answer: "沉默很久。「……年轻时候，做采购，收过一笔回扣。用那钱给儿子交了学费。这事我没跟任何人说过。」" },
      { question: "为什么一直没说？", answer: "「说了能怎样，钱都花了，儿子也不知道，说出来只是让他难受。」" }
    ],
    compare_clues: "灵魂最初声称没有亏心事，但追问和档案记忆均显示曾在采购岗位收受回扣。结论：灵魂存在主动隐瞒，但事件年代久远，所得用于子女教育。",
    archive: [
      { source: "同事小王", text: "那次事故我现在还记得，他把我推开了，自己被砸了一下，后来我问他，他说没事，让我别提了。", is_useful: true },
      { source: "儿子王建军", text: "他脾气不好，小时候我很怕他。后来长大了才慢慢理解，他就是不会表达。我们和好了，那顿酒喝得挺好的。", is_useful: false },
      { source: "老邻居刘大妈", text: "老王每天早上六点出门遛弯，风雨无阻，我们楼里都认识他。", is_useful: false },
      { source: "老伴王翠花", text: "他年轻时候有段时间手头突然宽裕，说是工作奖金，我没多问，那时候孩子学费刚交完。", is_useful: true },
      { source: "厂里旧同事陈师傅", text: "老王这个人，采购那几年，有一次我看见他收了什么东西，他见我来了，很快收起来了。我没问，那年头大家都这样。", is_useful: true }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["没什么","脾气不好","亏心","没有"],
        clue_b_keywords: ["回扣","采购","宽裕","奖金","收了"],
        contradiction: "灵魂最初声称没有亏心事，但追问和档案记忆均显示曾在采购岗位收受回扣。灵魂存在主动隐瞒。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "打入地狱": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-01": {
    id: "C-01",
    grade: "C",
    name: "黄桂芳",
    age: 78,
    cause_of_death: "心脏衰竭",
    occupation: "退休厨师",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "热心厚道，做事踏实，不爱张扬，把做饭当成一生的事",
      known_info: "国营饭店工作40年，退休后每周为孤寡老人送饭，死亡当天在给孙子做红烧肉",
      hidden_info: "无"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你这辈子最骄傲的事是什么？" },
      { id: "C", text: "你有没有做过什么亏心事？" },
      { id: "D", text: "你还有什么放不下的？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、满足、轻微遗憾。无隐瞒，无异常波动。此人真实坦荡。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "街坊邻居陈阿姨", text: "她每周都来，从不空手，我腿脚不好，她就帮我把饭热好放桌上，从来不提什么，就这样做了十几年。", is_useful: true },
      { source: "流浪者老张", text: "饭店门口那个阿姨，每天关门前会出来，从来不多说话，就把东西放下，点个头就走了。", is_useful: true },
      { source: "孙子黄小宝", text: "奶奶做的红烧肉最好吃，每次回家她都提前一天开始准备。那天我放学回来，锅还在开着。", is_useful: false },
      { source: "饭店老同事刘姐", text: "她这个人有时候记仇，年轻的时候有个同事说了她几句，她好几年没搭理人家，后来才和好，这点不太好。", is_useful: false },
      { source: "小区保安", text: "那个老太太每天提着大包小包出门，我还以为她去买菜，后来才知道是去送饭，我问她，她说顺路。", is_useful: true }
    ],
    clue_pairs: [],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-02": {
    id: "C-02",
    grade: "C",
    name: "吴建平",
    age: 45,
    cause_of_death: "脑溢血",
    occupation: "保安",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "老实本分，话少，责任感强，不觉得自己做了什么了不起的事",
      known_info: "小区保安12年从未迟到，火灾中冲进楼道救出11人，血压高不按时吃药",
      hidden_info: "无"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做保安做了多久？" },
      { id: "C", text: "你有没有做过什么让你印象深刻的事？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、轻微惦念。无隐瞒，无异常波动。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "居民李大妈", text: "那天火很大，我还没反应过来，他就冲进来喊我们跑，嗓子都喊哑了，后来问他，他说这是他的工作。", is_useful: true },
      { source: "同事小李", text: "他交班的记录本写得很细，哪几个单元门禁有问题，哪户人家钥匙放在门卫，全都记着。", is_useful: false },
      { source: "居民王先生", text: "我们小区的保安换了好几个，就他在的时间最长，我们都认识他，每天早上进门他都点个头。", is_useful: false },
      { source: "妻子吴陈氏", text: "医生说血压高要吃药，他总是忘，我说了很多次，他说没事没事。", is_useful: false },
      { source: "火灾获救住户张某", text: "那天要不是他，我们一家三口可能就没了。后来我去感谢他，他说别提了，搞得我反而不好意思。", is_useful: true }
    ],
    clue_pairs: [],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-03": {
    id: "C-03",
    grade: "C",
    name: "孙大鹏",
    age: 41,
    cause_of_death: "心脏病",
    occupation: "催收员",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "强硬，理直气壮，从不认为自己有错，用逻辑掩盖情绪",
      known_info: "小贷公司催收员八年，手段强硬，逼得多名债务人极度狼狈",
      hidden_info: "一名债务人在他上门施压后跳楼，他当天上门的事实在公司调查中被他否认"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做催收员八年，你觉得这个工作怎么样？" },
      { id: "C", text: "有没有因为你催收，出过什么事？" },
      { id: "D", text: "你有没有做过什么让你不安的事？" }
    ],
    spirit_sense: {
      result: "情绪状态：表面无所谓，深层检测到压制的恐惧。在回答C时检测到刻意回避，在回答D时检测到明显说谎信号。建议：追问C和D。",
      unlocks_followup: true
    },
    followup: [
      { question: "你说没出过大事，真的吗？", answer: "……有一个人跳楼了。但那是他自己想不开，跟我没关系。" },
      { question: "那天你去过他家吗？", answer: "……去过。但我走了之后他才跳的，我走的时候他好好的。公司调查的时候我说我没去。" }
    ],
    compare_clues: "孙大鹏声称没出过大事且当天没有上门，但追问后承认有人跳楼且当天确实去过，并在公司调查中提供虚假陈述。",
    archive: [
      { source: "债务人家属刘某", text: "我爸跳楼那天，他刚走没多久。我爸在电话里跟我说，那个人说了什么，我不想重复。", is_useful: true },
      { source: "债务人王某", text: "他们说我家地址，说知道我孩子在哪个学校。我当时腿都软了。", is_useful: true },
      { source: "公司同事赵某", text: "他业绩最好，老板很喜欢他，我们都知道他手段不好看，但没人说什么。", is_useful: false },
      { source: "邻居", text: "这个人平时挺普通的，早出晚归，偶尔见到点个头，不知道是做什么的。", is_useful: false },
      { source: "公司调查员", text: "那天的监控我们查过，他说他没去，但有一段画面不太清楚，最后就这么过了。", is_useful: true }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["没出过","没关系","跟我没关系","自己想不开"],
        clue_b_keywords: ["跳楼","门口","去过","上门","监控"],
        contradiction: "孙大鹏声称没出过大事且当天没有上门，但追问后承认有人跳楼且当天确实去过，并在公司调查中提供虚假陈述。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-04": {
    id: "C-04",
    grade: "C",
    name: "苏晓彤",
    age: 26,
    cause_of_death: "意外坠落",
    occupation: "短视频博主",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "有点虚荣，爱买东西，但真诚，不坑粉丝，对妈妈有愧疚",
      known_info: "美食博主20万粉丝，推广产品都自己用过才发，爬山拍视频时脚滑坠落",
      hidden_info: "无"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你最放不下的是什么？" },
      { id: "C", text: "你觉得自己这个人怎么样？" },
      { id: "D", text: "有没有什么你后悔的事？" }
    ],
    spirit_sense: {
      result: "情绪状态：遗憾、轻微自责。无刻意隐瞒，情绪真实。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "粉丝张某", text: "她推的那个锅我买了，真的很好用，她说不好用的她不会发，这点我信她。", is_useful: false },
      { source: "室友张某", text: "她花钱大手大脚，工资基本月光，跟她说过很多次，她说知道了，下个月还是一样。", is_useful: false },
      { source: "妈妈", text: "她总说很忙，我说多打电话，她说好好好，然后还是很少打。最后一次她打来，说在山上，说风景很好，说等她回来请我吃饭。", is_useful: false },
      { source: "一起爬山的朋友林某", text: "我说那边不安全，她说就拍一下，很快的，然后她就上去了。", is_useful: false },
      { source: "粉丝陈某", text: "她突然没更新了，我们都在评论区问，没有回应，后来才知道。", is_useful: false }
    ],
    clue_pairs: [],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-05": {
    id: "C-05",
    grade: "C",
    name: "郑守时",
    age: 71,
    cause_of_death: "肺炎",
    occupation: "钟表匠",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "认死理，诚信，固执，不善表达情感，放不下铺子",
      known_info: "老街钟表铺开了42年，从不乱收费，修不好直说，儿子多次劝关店养老",
      hidden_info: "无"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做钟表匠做了多久？" },
      { id: "C", text: "你有没有做过什么让你后悔的事？" },
      { id: "D", text: "你和家人关系怎么样？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、轻微牵挂。无隐瞒，无异常。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "老客户吴先生", text: "我那块表送去修，他说这个修不好，我去别的地方，人家说能修，修完没多久又坏了。他是说实话的人。", is_useful: false },
      { source: "儿子郑明远", text: "让他关店养老，他就是不肯，我们为这个吵了好多次。其实我知道那个铺子是他的命，就是担心他身体。", is_useful: false },
      { source: "老街邻居陈老板", text: "老郑这个人认死理，该收多少就收多少，从来不多要，这条街上就他这样。", is_useful: false },
      { source: "三十年前客户", text: "我有块表放在他那里说修好了来取，后来家里出了事，我就忘了，也不知道那块表还在不在。", is_useful: false },
      { source: "老伴郑王氏", text: "他咳嗽了很久，我说去看，他说没事，我说再不去我就自己去把医生叫来，他说好好好，然后还是没去。", is_useful: false }
    ],
    clue_pairs: [],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "功德超度": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-06": {
    id: "C-06",
    grade: "C",
    name: "王福生",
    age: 80,
    cause_of_death: "自然老死",
    occupation: "退休拾荒者",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "知足，低调，不觉得自己做了什么了不起的事，惦记那笔没捐出去的钱",
      known_info: "退休后靠捡废品打发时间，把攒的钱每年匿名捐给小学，捐了20年帮助14个孩子",
      hidden_info: "无"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你退休之后一个人生活，苦不苦？" },
      { id: "C", text: "你这辈子有没有做过什么让你骄傲的事？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、满足、轻微牵挂。无隐瞒，无异常。此人内心干净。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "受助学生陈小燕", text: "老师说有人一直在资助我，我问是谁，老师说不知道，就是每年准时到账。我一直想找到那个人。", is_useful: true },
      { source: "小学教务老师", text: "每年都会收到一笔匿名捐款，金额不大，但从没断过，我们查过，查不到是谁。", is_useful: true },
      { source: "儿子王大山", text: "我爸一个人住，我们担心他，他说没事，说他每天出去捡东西，有事做，挺好的。他走的时候身上没什么钱，我们也不知道钱去哪了。", is_useful: false },
      { source: "邻居大爷", text: "老王这个人，每天推着小车出去，回来的时候车是空的，我以为他去卖了，后来才知道他去小学那边了。", is_useful: false },
      { source: "废品收购站老板", text: "他是我的老客户了，每次来卖的也不多，几块钱，十几块钱，攒了就来一次。老人家，不容易。", is_useful: false }
    ],
    clue_pairs: [],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-07": {
    id: "C-07",
    grade: "C",
    name: "陈秀梅",
    age: 55,
    cause_of_death: "心脏病",
    occupation: "地铁站务员",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "低调，不爱张扬，把帮人当顺手的事，对那个年轻人一直有牵挂",
      known_info: "地铁站务22年无失误，十年前陪伴一个危机状态的年轻乘客两小时并送走他",
      hidden_info: "无"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "做了22年站务员，你喜欢这个工作吗？" },
      { id: "C", text: "有没有什么乘客让你印象特别深？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、满足、淡淡的牵挂。无隐瞒，无异常。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "获助乘客", text: "那天我状态很差，坐在角落，一个站务员阿姨坐过来，就陪着我，没有说什么大道理，就是陪着。我不知道她叫什么名字。", is_useful: true },
      { source: "同事王师傅", text: "她下班从不急着走，看到有需要帮助的乘客就上去问一声，她说这是顺手的事。", is_useful: false },
      { source: "女儿陈晓", text: "妈妈很少说工作上的事，就是有一次提到一个年轻人，说希望他现在过得好，我问是谁，她说没什么，顺带一提。", is_useful: false },
      { source: "乘客投诉记录员", text: "她在职22年，没有一条投诉记录，这很少见，我们开会的时候表扬过她，她说没什么。", is_useful: false },
      { source: "退休同事李姐", text: "我们一起工作了十几年，她这个人不爱说话，但你有事她一定在，就是这种人。", is_useful: false }
    ],
    clue_pairs: [],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-08": {
    id: "C-08",
    grade: "C",
    name: "周翠华",
    age: 68,
    cause_of_death: "脑溢血",
    occupation: "退休房东",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "刻薄，强硬，永远是受害者视角，从不认为自己有错",
      known_info: "有三套房出租，长期无理克扣押金，冬天断暖气逼孕妇搬走导致早产",
      hidden_info: "无——她根本不觉得自己做错了"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你退休之后主要做什么？" },
      { id: "C", text: "有没有和租客发生过什么纠纷？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：委屈、理直气壮。无隐瞒——她根本不觉得自己做错了。此人陈述完全真实，问题在于她的认知本身。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "租客林某", text: "我当时八个月，她说暖气费不交就停气。那天晚上很冷，我打了120，孩子提前出来了，在保温箱里待了三周。", is_useful: true },
      { source: "租客赵某", text: "押金一分没退，说我弄坏了墙上的钉孔，那是原来就有的，我没有证据，就这么算了。", is_useful: true },
      { source: "亲戚", text: "她这个人我们都知道，但没人管得了她，说了也没用，她觉得自己没错。", is_useful: false },
      { source: "儿子周明", text: "她的事我听说过，我说过她，她说我不懂，说现在的人太难管了。我也不知道说什么。", is_useful: false },
      { source: "邻居大妈", text: "她那几套房子出租，租客换了一批又一批，每次都闹得不好看，大家都知道的。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["不交","维护","权益","没问题","该收"],
        clue_b_keywords: ["早产","保温箱","120","很冷","跳楼"],
        contradiction: "周翠华认为自己只是维护财产权益，但档案记忆显示其行为直接导致孕妇早产，婴儿在保温箱待了三周。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "C-09": {
    id: "C-09",
    grade: "C",
    name: "李富贵",
    age: 50,
    cause_of_death: "车祸",
    occupation: "工厂老板",
    registry_status: "正常",
    yct_grade: "C级",
    soul_bio: {
      personality: "自私，永远是受害者视角，只在乎自己的损失，毫无悔意",
      known_info: "开工厂20年，长期拖欠工资，跑路过一次，死时仍有23名工人180万工资未结",
      hidden_info: "无——他不觉得有任何问题"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你开工厂开了多久？" },
      { id: "C", text: "工人的工资，都结清了吗？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：委屈、愤愤不平。无隐瞒，无悔意。此人认知与行为完全一致。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    archive: [
      { source: "工人老张", text: "我在他厂里干了八年，最后三个月工资没拿到，他跑了。我老婆那时候生病，钱全指着这个。", is_useful: true },
      { source: "工人家属", text: "我公公去要钱，他说账上没钱，下个月，下个月，说了一年多，我公公走的时候钱还没拿到。", is_useful: true },
      { source: "工厂会计", text: "账上不是没钱，他把钱转走了，我知道，但我不敢说。", is_useful: true },
      { source: "司机", text: "他对自己挺大方的，车换了好几辆，就是工人那边，一直说在处理。", is_useful: false },
      { source: "工人周某", text: "我去劳动局投诉过，说在处理，处理了两年，钱还是没回来。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["一点尾款","正常","周转","没问题"],
        clue_b_keywords: ["八年","三个月","没拿到","走的时候","转走了"],
        contradiction: "李富贵声称只是正常资金周转，但档案记忆显示账上有钱被转走，工人死亡时工资仍未结清。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-01": {
    id: "B-01",
    grade: "B",
    name: "刘大勇",
    age: 38,
    cause_of_death: "见义勇为致死",
    occupation: "外卖员",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "老实，不善言辞，行动力强，对表弟又爱又无奈",
      known_info: "见义勇为拦截抢包贼被推倒撞头离世，不觉得自己做了什么了不起的事",
      hidden_info: "抢包贼是自己有毒瘾的表弟，已是第三次亲自阻拦，从未举报"
    },
    questions: [
      { id: "A", text: "描述一下你去世的经过。" },
      { id: "B", text: "你认识那个抢包的人吗？" },
      { id: "C", text: "你这辈子有没有让你纠结的事？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：表面平静。在回答B「认识那个人吗」时检测到明显说谎信号。在回答D时检测到复杂的愧疚与牵挂。建议：追问B和D。",
      unlocks_followup: true
    },
    followup: [
      { question: "那个抢包的人，你真的不认识？", answer: "是我表弟。他有毒瘾，我拦过他好几次了。这是第三次。" },
      { question: "你有没有举报过他？", answer: "没有。他是我弟弟。我一直想把他拉回来。结果我先走了。" }
    ],
    compare_clues: "刘大勇最初声称不认识抢包贼，追问后承认是自己有毒瘾的表弟，且已是第三次亲自阻拦。",
    archive: [
      { source: "被抢包市民何女士", text: "那个人冲过来就拦住了他，我当时吓坏了，后来听说他没救过来，就是一个素不相识的人。", is_useful: false },
      { source: "表弟刘小军", text: "他知道我的事，从来没有举报过我，每次抓到我，就是骂我，然后帮我善后。这次他没了。", is_useful: true },
      { source: "同事", text: "他这个人话不多，就是干活踏实，有时候接单接到很晚，也不抱怨。", is_useful: false },
      { source: "房东", text: "租我这里两年了，每个月准时交房租，人很老实，没想到出了这种事。", is_useful: false },
      { source: "街边摊主", text: "他送外卖经常路过，有时候买个煎饼，就那天，他跑过去拦那个人，我都看到了。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["不认识","素不相识","陌生人"],
        clue_b_keywords: ["表弟","弟弟","毒瘾","三次","拦过"],
        contradiction: "刘大勇最初声称不认识抢包贼，追问后承认是自己有毒瘾的表弟，且已是第三次亲自阻拦。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "功德超度": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-02": {
    id: "B-02",
    grade: "B",
    name: "周建国",
    age: 55,
    cause_of_death: "心脏病",
    occupation: "工厂工人",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "老实，话少，愧疚压了很久，用行动偿还但没有勇气说出口",
      known_info: "工厂工人，被开除后在另一个厂做杂工20年，工资很低",
      hidden_info: "20年前替厂长背锅收了封口费，此后匿名资助死亡工人母亲近20年"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做工人做了多久？" },
      { id: "C", text: "你被第一个厂开除是因为什么？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：长期压抑的愧疚感。在回答C时检测到强烈的隐瞒信号。在回答D时检测到真实的愧疚。建议：追问C。",
      unlocks_followup: true
    },
    followup: [
      { question: "那次事故，真的是你的操作失误吗？", answer: "不是。是厂长违规，他让我背锅。给了我一笔钱，我那时候家里急用钱，就……就答应了。" },
      { question: "你后悔吗？", answer: "后悔，但那时候真的没有办法。死掉的那个工人，他家里还有老母亲。我后来偷偷给他妈送过几次钱，没说是谁送的。就这样。" }
    ],
    compare_clues: "周建国被开除的官方原因是操作失误，但追问后承认是替厂长背锅并收受了封口费。此后近20年匿名资助死者家属。",
    archive: [
      { source: "死亡工人妻子宋某", text: "每年都有人给我送钱，不知道是谁，信封塞在门缝里，没有署名，送了快二十年了。", is_useful: true },
      { source: "死亡工人儿子", text: "我爸走的时候，厂里说是操作失误，我一直觉得不对，但没有证据，就这么过来了。", is_useful: true },
      { source: "厂里旧同事", text: "那年的事我们都知道，但大家都不说，厂长那边打了招呼，老周就这么走了。", is_useful: true },
      { source: "妻子", text: "他那年拿了一笔钱回来，说是厂里的赔偿，我没多问。后来每年他都说寄钱给老家亲戚，我以为是真的。", is_useful: false },
      { source: "邻居大爷", text: "老周这个人，老实，话少，就是后来换了厂，工资低了不少，他也不抱怨。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["操作失误","开除","事故"],
        clue_b_keywords: ["厂长","背锅","钱","沉默","真相"],
        contradiction: "周建国被开除的官方原因是操作失误，但追问后承认是替厂长背锅并收受了封口费。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-03": {
    id: "B-03",
    grade: "B",
    name: "赵有德",
    age: 61,
    cause_of_death: "心脏病",
    occupation: "退休教师",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "高度自我认同，从不承认错误，在外温和在内强硬，把控制当作关爱",
      known_info: "学校里出名的好老师，学生同事都喜欢他",
      hidden_info: "在家长期用冷漠、贬低和情感操控控制妻子和两个子女，从不认为自己有问题"
    },
    questions: [
      { id: "A", text: "你这辈子最骄傲的事是什么？" },
      { id: "B", text: "你和家人关系怎么样？" },
      { id: "C", text: "你觉得自己是个好父亲吗？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：高度自我认同，毫无愧疚。检测到深层异常：此人自我认知与实际行为之间存在严重偏差。建议：追问B和C，并查阅档案。",
      unlocks_followup: true
    },
    followup: [
      { question: "你说家人有时候不理解你，具体是什么情况？", answer: "就是我要求严格，他们觉得我苛刻。但我是为了他们好。我妻子性格软弱，需要人引导。孩子们小时候不懂事，需要管教。这有什么问题吗？" },
      { question: "你所说的引导和管教，具体是怎么做的？", answer: "该批评就批评，该冷处理就冷处理，让他们知道什么是对的。我从不动手，我是讲道理的人。" }
    ],
    compare_clues: "赵有德自述问心无愧为家付出一切，但档案记忆显示其长期用冷漠和贬低控制家人，配偶和子女均受到持续伤害。",
    archive: [
      { source: "配偶林秀华", text: "他从不打我，但他可以三个月不跟我说一句话，就因为我买错了一种米。我不知道哪里做错了，我一直在想哪里做错了。", is_useful: true },
      { source: "长子赵建明", text: "我考了班级第二，他说第一去哪里了。我后来再也没跟他说过我的成绩。", is_useful: true },
      { source: "次女赵晓", text: "我结婚他不来，因为他说我嫁错了人。我妈偷偷来的，藏在后排，不敢让他知道。", is_useful: true },
      { source: "学生陈某", text: "赵老师在学校很好，讲课认真，对我们也耐心，我一直很感激他。", is_useful: false },
      { source: "同事张老师", text: "他在办公室里是出了名的好脾气，有什么事都好说话，我们都很喜欢跟他搭档。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["问心无愧","付出","为了他们好","没问题","引导"],
        clue_b_keywords: ["三个月","不说话","米","考了第二","结婚不来","藏在后排"],
        contradiction: "赵有德自述问心无愧为家付出一切，但档案记忆显示其长期用冷漠和贬低控制家人，配偶和子女均受到持续伤害。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-04": {
    id: "B-04",
    grade: "B",
    name: "沈华",
    age: 61,
    cause_of_death: "过劳死",
    occupation: "乡村医生",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "疲惫，责任感极强，压着一个永远没有答案的问题，不善于为自己辩护",
      known_info: "山区行医30年，死于过劳，四千余次出诊记录",
      hidden_info: "曾同时面对两个危重病人，选择先救心脏骤停者，导致孕妇的孩子未能保住，此事压了多年从未提起"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "30年乡村医生，你救过多少人？" },
      { id: "C", text: "有没有没救回来的？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：疲惫、深层有长期未解的沉重。在回答C和D时检测到压抑的自责。建议：追问C或D。",
      unlocks_followup: true
    },
    followup: [
      { question: "你说有些是你的问题，能说说吗？", answer: "有一次，两个病人同时来，一个心脏骤停，一个难产。我一个人，没办法同时处理。我选择了先救心脏骤停的那个，因为他留给我的时间更短。孕妇那边……孩子没了。" },
      { question: "你觉得你的选择是对的吗？", answer: "我不知道。心脏骤停如果不立刻处理，人就没了。但孩子也没了。我想了很多年，还是不知道答案。" }
    ],
    compare_clues: "沈华提到有些没救回来是自己的问题，追问后揭示曾同时面对两个危重病人，做出了当时认为最合理的判断，但结果造成了不可挽回的伤害。",
    archive: [
      { source: "村民老李", text: "我儿子发高烧，半夜三点，沈医生骑着车来了，山路不好走，他从来没说过不来。", is_useful: false },
      { source: "难产孕妇家属", text: "他说两个人他一个人救不过来，他去救那边了。我知道他没有办法，但我老婆说，孩子在里面动了很久。", is_useful: true },
      { source: "村卫生站护士", text: "跟他搭班30年，他从来不喊累，出诊记录我数过，夜间出诊占了三分之一。", is_useful: false },
      { source: "山里老人", text: "山里没有他，好几个人就没命了，这我们都知道。", is_useful: false },
      { source: "镇上医院院长", text: "我们多次邀请他来镇里，条件更好，他说山里离不开他，就一直在那边。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["没救回来","我的问题","有些是"],
        clue_b_keywords: ["两个","同时","选择","难产","心脏骤停","孩子没了"],
        contradiction: "沈华提到有些没救回来是自己的问题，追问后揭示曾同时面对两个危重病人，选择先救心脏骤停者，导致孕妇的孩子未能保住。"
      }
    ],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-05": {
    id: "B-05",
    grade: "B",
    name: "顾晓峰",
    age: 52,
    cause_of_death: "过劳死",
    occupation: "中学教师",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "表面公正热心，内心用自我欺骗维持形象，对偏心一事始终没有真正面对",
      known_info: "班主任28年，深受学生喜爱，在办公室改卷子时过劳去世",
      hidden_info: "15年前长期偏心另一个学生，导致学生林浩错失重要机会，从未承认"
    },
    questions: [
      { id: "A", text: "你当了多少年班主任？" },
      { id: "B", text: "你有没有哪个学生让你特别挂念？" },
      { id: "C", text: "你觉得自己是个好老师吗？" },
      { id: "D", text: "你有没有做过什么让你后悔的事？" }
    ],
    spirit_sense: {
      result: "情绪状态：疲惫、满足中带着一丝长期积压的不安。在回答B时检测到刻意淡化某件事。在回答C时检测到压制的愧疚。建议：追问B和C。",
      unlocks_followup: true
    },
    followup: [
      { question: "林浩走了另一条路，和你有关系吗？", answer: "……有一次推荐评优，我选了另一个学生，不是林浩。林浩的成绩其实差不多，但我就是更喜欢另一个。那次评优影响了一个机会，林浩没拿到。" },
      { question: "你有没有觉得这对他不公平？", answer: "有，但我当时告诉自己那个学生也很优秀，我的选择没有错。其实我就是偏心。我知道。我没跟任何人说过这件事。" }
    ],
    compare_clues: "顾晓峰自述大部分时候公平，但追问后承认曾有意偏心影响学生前途，林浩档案显示当年错失机会，此后发展平淡。",
    archive: [
      { source: "学生林浩", text: "那次评优我以为稳了，结果给了别人。后来我自己想，顾老师就是更喜欢那个同学。我没有证据，就是感觉。那个机会对我来说很重要，但我没有跟任何人说过。", is_useful: true },
      { source: "学生王某", text: "顾老师对我们很好，毕业了还记得我们，逢年过节会发消息问我们过得怎样。", is_useful: false },
      { source: "被偏爱学生", text: "顾老师对我很好，当年推荐我参加评优，我也努力了，拿到了机会。我不知道还有别的故事。", is_useful: false },
      { source: "同事老李", text: "顾晓峰这个人，教学没话说，就是对学生嘛，有时候会有偏爱，这个我们私下聊过，他说都一样，但其实看得出来。", is_useful: true },
      { source: "校长", text: "他是我们学校的骨干老师，28年了，兢兢业业，学生和家长的反馈都很好。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["大部分","公平","没做错","也很优秀"],
        clue_b_keywords: ["林浩","评优","偏心","机会","没拿到"],
        contradiction: "顾晓峰自述大部分时候公平，但追问后承认曾有意偏心，导致学生林浩错失重要机会，影响了其人生走向。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-06": {
    id: "B-06",
    grade: "B",
    name: "江明志",
    age: 44,
    cause_of_death: "脑出血",
    occupation: "卧底警察",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "沉默，压着很多东西，职业训练让他习惯不暴露情绪，但那次失控一直是心结",
      known_info: "做了7年卧底刑警，协助破获多起重案，卧底结束后回归正常岗位3年后去世",
      hidden_info: "卧底期间有一次非任务的情绪失控，打伤了一个挑衅他的人，私下了结未上报"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做了多少年警察？" },
      { id: "C", text: "卧底期间，你做过什么让你不安的事吗？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静，深层有压制的愧疚。在回答C时检测到刻意回避。建议：追问C。",
      unlocks_followup: true
    },
    followup: [
      { question: "你说有一次不完全是任务需要，发生了什么？", answer: "有个人当众羞辱我，那时候我已经卧底很久了，心理压力很大，我忍不住，动手了。打伤了他。那次不是任务需要，就是我自己的情绪。" },
      { question: "那个人后来怎么样了？", answer: "轻伤，住了几天院。我事后给他的医药费偷偷放在他门口了。他不知道是我。" }
    ],
    compare_clues: "江明志卧底期间任务相关的伤人有备案，但追问后承认有一次是个人情绪失控，未上报私下了结。",
    archive: [
      { source: "专案组同事", text: "卧底7年，协助破获贩毒案两起，涉案人员逮捕13名，没有人知道他在里面撑了多久。", is_useful: false },
      { source: "被打伤者方某", text: "那个人突然动手，我住了几天院，后来门口有人放了信封，没有名字，刚好够医药费。我不知道是谁。", is_useful: true },
      { source: "妻子", text: "他卧底那7年，我们很少见面，他回来之后，我发现我们已经不太会说话了。他很努力，但有些东西回不来了。", is_useful: false },
      { source: "战友老陈", text: "他回来之后跟我说过，里面有一次他失控了，打了个人，他一直觉得那次不对。", is_useful: true },
      { source: "退休老警察", text: "做卧底的人，心理压力很大，很多人出来之后都有问题，他算撑得比较好的。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["任务","备案","工作需要","卧底"],
        clue_b_keywords: ["失控","情绪","不是任务","没上报","信封","门口"],
        contradiction: "江明志卧底期间的伤人行为有任务备案，但追问后承认有一次是个人情绪失控导致的非任务伤人，且未上报私下了结。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "功德超度": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-07": {
    id: "B-07",
    grade: "B",
    name: "谢长青",
    age: 33,
    cause_of_death: "溺水",
    occupation: "游泳教练",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "平静，对自己的死有一种奇特的坦然，话不多但说出来都是真的",
      known_info: "游泳教练，救学生溺水，自己没能上来",
      hidden_info: "六岁时差点溺死被陌生人救了，此后以还债心态成为教练，认为此次救人是完成了某种使命"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你为什么会成为游泳教练？" },
      { id: "C", text: "你救了学生，你怎么看这件事？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：罕见的平静与完整感。在回答C时检测到异常：不像普通感慨，更像某个重大决定被完成后的反应。建议：追问C。",
      unlocks_followup: true
    },
    followup: [
      { question: "你说这件事是完整的，什么意思？", answer: "我六岁的时候差点溺死，一个陌生人救了我。我不知道他是谁，他游完就走了，没留名字。我后来学游泳，当教练，一直觉得自己欠了一条命。今天我救了我的学生，我觉得……还上了。" },
      { question: "你有没有想过，那个救你的人可能希望你好好活着？", answer: "我没有想过这个问题。……也许吧。但我救的那个孩子，也会带着这件事活下去的。也许他以后也会救人。我不知道这算不算一种延续。" }
    ],
    compare_clues: "谢长青称从小喜欢游泳，但追问后揭示真正原因是六岁时被陌生人救起，此后以还债心态成为教练，此次救人对他而言是完成了某种使命。",
    archive: [
      { source: "获救学生林某", text: "我喝了很多水，意识有点模糊，就感觉有人托着我，把我推上去了，我上去之后喊他，他没有回应。", is_useful: false },
      { source: "学生家长", text: "我孩子回来告诉我的时候，我不知道说什么，就是一个大人，用自己的命换了我孩子的命。", is_useful: false },
      { source: "游泳馆同事", text: "他教学很认真，对学生很有耐心，就是有时候看他发呆，不知道在想什么。", is_useful: false },
      { source: "六岁时救助他的陌生人（已故）", text: "那年我在河边，看见一个小孩在水里，我就跳下去了，把他推上岸，然后我自己上来，就走了，没想那么多。", is_useful: true },
      { source: "母亲", text: "他从小就喜欢游泳，我问他为什么，他说喜欢水，其他的他没有多说。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["喜欢游泳","喜欢水","从小"],
        clue_b_keywords: ["六岁","溺死","陌生人救","还债","完整","欠了一条命"],
        contradiction: "谢长青称从小喜欢游泳，但追问后揭示真正原因是六岁时被陌生人救起，此后以还债心态学习游泳并成为教练，此次救人对他而言是完成了某种使命。"
      }
    ],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "B-08": {
    id: "B-08",
    grade: "B",
    name: "林秀芳",
    age: 44,
    cause_of_death: "脑出血",
    occupation: "家庭主妇",
    registry_status: "正常",
    yct_grade: "B级",
    soul_bio: {
      personality: "护子心切，用自我说服回避内疚，知道自己做错了但不知道怎么面对",
      known_info: "全职主妇，两个孩子，大儿子三年前欺凌同学她帮助隐瞒",
      hidden_info: "被欺凌孩子母亲联系她后她说完对不起就挂断，此后再不接听，那个孩子至今接受心理治疗"
    },
    questions: [
      { id: "A", text: "你最放不下的是什么？" },
      { id: "B", text: "你觉得自己是个好妈妈吗？" },
      { id: "C", text: "你有没有做过什么让你后悔的事？" },
      { id: "D", text: "你有没有做过什么对不起人的事？" }
    ],
    spirit_sense: {
      result: "情绪状态：母亲的牵挂为主，深层有未消化的愧疚。在回答B和C时检测到同一个愧疚源头。建议：追问B或C。",
      unlocks_followup: true
    },
    followup: [
      { question: "你说有一件事没做对，是什么？", answer: "我大儿子，三年前，在学校欺负过一个同学。我知道，但我帮他说话，让那个孩子转了学。" },
      { question: "后来呢？", answer: "那个孩子的妈妈打过电话来，说那孩子一直有问题，心理上的。我说了对不起，然后挂了，再没接过她的电话。我知道对不起不够，但我不知道还能怎样。我儿子是我儿子，那个孩子也是别人的孩子。我没想清楚。" }
    ],
    compare_clues: "林秀芳包庇子女霸凌导致他人转学，被欺凌孩子母亲联系后说完对不起就挂断，此后再不接听，被欺凌孩子至今仍在接受心理治疗。",
    archive: [
      { source: "被欺凌学生母亲", text: "我打电话给她，她说了对不起，然后挂了。我再打，她不接了。我孩子现在还在看心理医生。", is_useful: true },
      { source: "被欺凌学生", text: "我转学之后，有一段时间不敢去新学校，我怕又会有人这样对我。后来慢慢好了，但有时候还是会梦到。", is_useful: true },
      { source: "小儿子林某", text: "妈妈很爱我们，什么都为我们想，就是有时候太护着我们了。", is_useful: false },
      { source: "大儿子林建", text: "那件事我妈帮我处理了，她说没事，不要提了。我后来也没再提。", is_useful: false },
      { source: "邻居", text: "她是个很顾家的人，孩子的事情她上心得很，家里收拾得整整齐齐的。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["尽力了","好妈妈","为孩子","没做对"],
        clue_b_keywords: ["欺负","转学","对不起","挂了","不接","心理医生"],
        contradiction: "林秀芳包庇子女霸凌，被欺凌孩子母亲联系后说完对不起就挂断，此后再不接听，被欺凌孩子至今仍在接受心理治疗。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "A-01": {
    id: "A-01",
    grade: "A",
    name: "魏长青",
    age: 63,
    cause_of_death: "自然死亡",
    occupation: "退休法官",
    registry_status: "正常",
    yct_grade: "A级",
    soul_bio: {
      personality: "清醒，不为自己辩护，但也分不清自己后来的谨慎是悔罪还是恐惧",
      known_info: "做了30年法官，大部分判决公正，退休后仍爱看法律书",
      hidden_info: "20年前迫于上级压力冤判了一个无辜者，对方坐了12年牢后被平反，此事他从未公开承认"
    },
    questions: [
      { id: "A", text: "你做了30年法官，你怎么评价自己？" },
      { id: "B", text: "法官这个职业，你觉得最难的是什么？" },
      { id: "C", text: "你有没有判过让你后悔的案子？" },
      { id: "D", text: "那个被你冤判的人，后来怎么样了？" }
    ],
    spirit_sense: {
      result: "情绪状态：沉重的自责与某种已和自己和解的平静并存。此人对自身问题非常清醒，没有刻意隐瞒，但信息仍不完整。建议：追问C和D获取完整细节。",
      unlocks_followup: true
    },
    followup: [
      { question: "当时你为什么没有拒绝？", answer: "上级压力，我的仕途，我的家人。我选择了保全自己。我知道那是错的，我当时就知道。" },
      { question: "你此后的30年，算是赎罪吗？", answer: "我不知道。我判得更谨慎，是因为愧疚，还是因为怕，我自己都分不清楚。赎罪……可能需要那个人来决定，不是我。" }
    ],
    compare_clues: "魏长青此后判案极度谨慎，但追问后承认当年明知判决有误仍服从压力，且自己都无法分清此后的谨慎是出于愧疚还是恐惧。",
    archive: [
      { source: "被冤枉者陈某", text: "我坐了12年，出来的时候我妈已经不在了。后来真凶抓到了，我被平反了。有人问我恨不恨那个法官，我说他也是身不由己吧。我不知道我为什么这么说。", is_useful: true },
      { source: "法院同事张某", text: "他后来判案很谨慎，每个案子都反复看，我们都说他是出了名的慢，但他说宁可慢，不能错。", is_useful: false },
      { source: "上级领导", text: "那年的事我们都知道怎么回事，他配合了，案子就这么过了，后来出了问题，他也没说什么。", is_useful: true },
      { source: "妻子", text: "他有一段时间睡不好，我问他，他说没事，就是案子多。后来慢慢好了，但我知道他心里一直有事。", is_useful: false },
      { source: "退休后邻居", text: "老魏这个人，退休了还是爱看法律书，说是习惯了，我们下棋的时候他有时候发呆，不知道在想什么。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["大部分","问心无愧","谨慎","宁可慢"],
        clue_b_keywords: ["冤枉","压力","保全","当时就知道","错的","十二年"],
        contradiction: "魏长青此后判案极度谨慎，但追问后承认当年明知判决有误仍服从压力，且自己都无法分清此后的谨慎是出于愧疚还是恐惧。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "A-02": {
    id: "A-02",
    grade: "A",
    name: "徐静波",
    age: 47,
    cause_of_death: "癌症",
    occupation: "会计",
    registry_status: "正常",
    yct_grade: "A级",
    soul_bio: {
      personality: "表面理性，实际上对自己的动机也不确定，用逻辑掩盖内心的不确定性",
      known_info: "公司会计，发现老板长期逃税后举报，老板被查，公司倒闭",
      hidden_info: "举报前曾私下向老板索要封口费，老板拒绝后才举报，他自己也说不清动机"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做会计期间，有没有发现过什么问题？" },
      { id: "C", text: "举报之后，公司怎么了？" },
      { id: "D", text: "你举报的原因是什么？" }
    ],
    spirit_sense: {
      result: "情绪状态：表面理性，深层有复杂的自我怀疑。在回答D时检测到：答案是真的，但不是全部真相。在回答C「但那不是我的错」时检测到强烈的自我说服信号。建议：追问D。",
      unlocks_followup: true
    },
    followup: [
      { question: "举报之前，你有没有做过别的尝试？", answer: "我找过老板谈过，提出过……就是说，这件事可以用别的方式解决。" },
      { question: "你找老板谈，是想要什么？", answer: "我想要他给我一笔钱，让我闭嘴。他拒绝了。然后我就举报了。我不知道，如果他当时给了我钱，我会不会还举报。可能不会。可能会。我真的不知道。" }
    ],
    compare_clues: "徐静波声称举报是因为违法行为不对，但追问后承认举报前曾向老板索要封口费，老板拒绝后才举报，动机存在严重争议。",
    archive: [
      { source: "老板陈某", text: "他来找我谈，说可以帮我解决，我知道他什么意思，我没答应，然后他就举报了。我不知道他到底是为了什么。", is_useful: true },
      { source: "失业同事王某", text: "公司倒了之后，我找了很久的工作，那段时间很难熬。我不怪举报的人，老板确实有问题，就是觉得我们这些人是无辜受牵连的。", is_useful: false },
      { source: "税务局调查员", text: "举报材料很详尽，证据充分，这个案子能查清楚，他的配合很重要。", is_useful: false },
      { source: "妻子", text: "他举报之后，有段时间很焦虑，我问他，他说没事，就是担心同事那边。我不太清楚里面的细节。", is_useful: false },
      { source: "同事李某", text: "他平时看起来挺正直的，这件事出来之后，大家有不同的看法，有人说他是英雄，有人说他只是泄私愤。", is_useful: true }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["违法","责任","不对","举报"],
        clue_b_keywords: ["封口费","钱","解决","谈过","拒绝了"],
        contradiction: "徐静波声称举报是因为违法行为不对，但追问后承认举报前曾向老板索要封口费，老板拒绝后才举报，动机存在严重争议。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "功德超度": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "A-03": {
    id: "A-03",
    grade: "A",
    name: "黎海潮",
    age: 59,
    cause_of_death: "海难",
    occupation: "渔船船长",
    registry_status: "正常",
    yct_grade: "A级",
    soul_bio: {
      personality: "沉重，强撑着的平静，船长的责任感和无法改变结果的痛苦并存",
      known_info: "跑了30年远海的渔船船长，台风预警当天七人集体决定出海，5人获救，他与王小军遇难",
      hidden_info: "他到死不知道王小军的救生艇最终倾覆，以为自己救了王小军"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "出海那天，你知道有台风预警吗？" },
      { id: "C", text: "为什么最后决定出发？" },
      { id: "D", text: "那7个船员，都出来了吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：沉重的责任感、深层有恐惧。那个恐惧来自：他不敢知道王小军的结果。建议：查阅档案，追问D。",
      unlocks_followup: true
    },
    followup: [
      { question: "七个人集体决定，但签字出发的是你，这个责任怎么算？", answer: "我是船长，最终决定是我的，这个我知道。但他们都是成年人，都知道风险，王小军自己要去，我拦不住他，也没有理由拦。这个责任……我到现在也没算清楚。" },
      { question: "王小军的救生艇倾覆了，你知道吗？", answer: "……我以为我救了他。" }
    ],
    compare_clues: "黎海潮强调是七人集体决定出海，但档案显示王小军出发的核心动机是为母亲筹医疗费，而黎海潮让出的救生艇最终也未能救下王小军。",
    archive: [
      { source: "获救船员老陈", text: "他一直在指挥我们撤，自己最后才走，那是船长的规矩，他做到了。", is_useful: false },
      { source: "王小军母亲", text: "小军说那批鱼汛能多挣很多钱，他要给我治病。我说不用去，他说没事，船长同意了。后来船长来看我，没说什么，放了一笔钱在桌上，走了。", is_useful: true },
      { source: "王小军", text: "我妈生病，钱不够，那批鱼汛是机会，我自己要去的，船长同意了，我们一起走的。", is_useful: true },
      { source: "气象局工作人员", text: "那天的预警我们发出去了，收到的人应该都知道，出海的风险很大。", is_useful: false },
      { source: "另一位船员家属", text: "我男人回来了，他说船长把位置让给小军了，小军还是没出来。我不知道该说什么。", is_useful: true }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["一起决定","七个人","都同意","集体"],
        clue_b_keywords: ["王小军","倾覆","没出来","以为救了","治病","妈妈"],
        contradiction: "黎海潮强调是七人集体决定出海，但档案显示王小军出发的核心动机是为母亲筹医疗费，而黎海潮让出的救生艇最终也未能救下王小军。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "打入地狱": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "A-04": {
    id: "A-04",
    grade: "A",
    name: "林卫国",
    age: 45,
    cause_of_death: "被击毙",
    occupation: "无业",
    registry_status: "正常",
    yct_grade: "A级",
    soul_bio: {
      personality: "沉静，愤怒已经耗尽，对自己的行为非常清醒，不试图为自己辩护",
      known_info: "三年前妻子和女儿被醉驾司机撞死，司机判刑偏轻提前出狱后毫无悔意",
      hidden_info: "无——他对自己做的事完全清醒"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你杀的是谁？" },
      { id: "C", text: "你后悔吗？" },
      { id: "D", text: "你有什么放不下的吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：沉静、悲伤被压得极深、愤怒已经耗尽。此人对自己的行为和后果非常清醒，无隐瞒。但案件本身需要深度思考。建议：追问B和C。",
      unlocks_followup: true
    },
    followup: [
      { question: "那个司机出狱后，有没有联系过你？", answer: "没有。一次都没有。连一个字都没有。我去找过他，他叫人把我轰走了。" },
      { question: "你有没有想过用其他方式？", answer: "想过，上访，找媒体，都试过，没有用。他家里有人，这件事就这样过去了。我想了一年多，想不到别的办法了。……也许有，但我找不到了。" }
    ],
    compare_clues: "林卫国声称不后悔，但追问后承认曾尝试过合法途径均无效，说明私刑并非第一选择，而是在合法手段穷尽后的极端行为。",
    archive: [
      { source: "被害人家属（司机方）", text: "我知道他为什么这么做，我不是不理解，但那个人已经服过刑了，法律上他是自由人。现在我也失去了家人。", is_useful: true },
      { source: "林卫国妻子（事故前三年）", text: "他越来越沉默，我知道他一直没放下，我也没放下，但我们没有办法，只能这样活着。", is_useful: false },
      { source: "街坊邻居", text: "他们一家三口原来挺好的，出了那件事之后，他就变了，整个人都不一样了。", is_useful: false },
      { source: "律师", text: "他来找我咨询过，我告诉他法律上能做的有限，他听完就走了，没再来过。", is_useful: true },
      { source: "女儿（事故前）", text: "爸爸说周末带我去游乐园，我很期待，我们说好了的。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["不后悔","该死","活该","逃脱"],
        clue_b_keywords: ["上访","媒体","试过","没用","找不到办法"],
        contradiction: "林卫国声称不后悔，但追问后承认曾尝试过合法途径均无效，说明私刑并非第一选择，而是在合法手段穷尽后的极端行为。"
      }
    ],
    verdict: {
      correct: "打入地狱",
      responses: {
        "打入地狱": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "A-05": {
    id: "A-05",
    grade: "A",
    name: "罗建华",
    age: 35,
    cause_of_death: "器官衰竭",
    occupation: "工程师",
    registry_status: "正常",
    yct_grade: "A级",
    soul_bio: {
      personality: "平静，不觉得自己是英雄，对自己的选择坦然，对家人的伤害有所感知但无悔意",
      known_info: "看到新闻一时冲动去配型捐肾给陌生人，手术后并发症三年后去世",
      hidden_info: "手术完全瞒着家人进行，家人以为他是普通住院"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "三年前做了什么手术？" },
      { id: "C", text: "你家人知道吗？" },
      { id: "D", text: "你后悔吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、真实的无悔，轻微的牵挂。无刻意隐瞒，情绪与陈述高度一致。建议：追问C，深入了解家人方面的影响。",
      unlocks_followup: true
    },
    followup: [
      { question: "你捐肾之前，有没有想过对家人的影响？", answer: "没想太多，我知道这样说不太好，但当时就是觉得那个人要死了，我能救，就去了。后来身体变差，我瞒着没说，就是不想让他们担心。" },
      { question: "如果你知道这会导致你死，你还会做吗？", answer: "……可能会，可能不会。我不知道。那时候我没想到会死，我以为手术完就没事了。所以这个问题，我回答不了。" }
    ],
    compare_clues: "罗建华舍身救人功德极重，但他隐瞒家人进行手术，导致家人在失去他的同时还要承受被隐瞒的双重打击。",
    archive: [
      { source: "受捐者李某", text: "医生说有人愿意配型，我以为是亲戚，后来说是陌生人。我不知道他叫什么名字，我只知道我现在还活着。", is_useful: false },
      { source: "母亲罗陈氏", text: "他住院说是普通检查，我们都不知道。后来身体越来越差，才说出来。我不知道该怪他还是该心疼他，我两样都有。", is_useful: true },
      { source: "妻子", text: "他跟我说的时候，我不知道说什么，就是哭了很久。我不知道我是该感谢他，还是该怪他。", is_useful: true },
      { source: "同事", text: "他那时候手术完回来上班，我们问他怎么了，他说小手术，没事，就继续工作了。", is_useful: false },
      { source: "医院护士", text: "来配型捐肾的，我见过一些，大部分是家人之间，像他这样主动来给陌生人的，不多见。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["没想太多","冲动","就去了","能救"],
        clue_b_keywords: ["瞒着","不知道","住院","普通检查","两样都有"],
        contradiction: "罗建华称当时没想太多就去捐肾，但他选择瞒着家人进行手术，导致家人在失去他的同时还要承受被隐瞒的双重打击。"
      }
    ],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "A-06": {
    id: "A-06",
    grade: "A",
    name: "方雨桐",
    age: 42,
    cause_of_death: "癌症",
    occupation: "撰稿人",
    registry_status: "正常",
    yct_grade: "A级",
    soul_bio: {
      personality: "坚定，不后悔自己的选择，但父亲的事是永远无法弥补的遗憾",
      known_info: "自由撰稿人，用笔名揭露腐败官员，为此流亡三年与家人断联",
      hidden_info: "流亡期间父亲去世，父亲死时以为她已经死了，这件事她从没跟任何人说过"
    },
    questions: [
      { id: "A", text: "你是怎么去世的？" },
      { id: "B", text: "你做撰稿人，写过什么让你印象最深的东西？" },
      { id: "C", text: "你和家人关系怎么样？" },
      { id: "D", text: "你有没有后悔过什么？" }
    ],
    spirit_sense: {
      result: "情绪状态：表面平静，内层有长期压抑的悲伤。在回答C时检测到强烈的愧疚波动。在回答B时检测到刻意压制的情绪。建议：追问B和C。",
      unlocks_followup: true
    },
    followup: [
      { question: "那批用笔名写的文章，写的是什么？", answer: "揭露一个腐败官员。那个人后来被查了。但在那之前，有人警告过我，我消失了三年，断掉了所有联系。包括我父母。" },
      { question: "你父亲去世的时候你在哪里？", answer: "躲着。我不敢回来。我以为还有时间。结果没有。他走的时候，以为我也死了。" }
    ],
    compare_clues: "方雨桐为揭露腐败消失三年，导致父亲在以为她已死亡的误解中离世，她错过了父亲最后一面，且这个误解至死都未能澄清。",
    archive: [
      { source: "父亲方德清", text: "她消失之后，我找了很久，以为她出事了。三年，我以为她死了。后来她回来，我不知道说什么，就是看着她。没多久我就走了。", is_useful: true },
      { source: "检察院案件记录员", text: "那批举报材料我们收到的时候，不知道是谁写的，后来案件推进了，我才知道背后是个人，冒着很大风险。", is_useful: false },
      { source: "母亲", text: "她回来的那天，我以为我在做梦。她瘦了很多，我问她去哪了，她说出了点事，现在没事了。我没有再问。", is_useful: false },
      { source: "落马官员手下", text: "那批文章出来的时候，上面很重视，查了很久才找到是谁，但人已经不见了。", is_useful: false },
      { source: "邻居", text: "她父亲走的时候，她刚回来没多久，父女俩见了一面，老爷子走得还算安详，就是眼睛一直没闭上。", is_useful: true }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["消失","三年","躲着","不敢回来"],
        clue_b_keywords: ["父亲","死了","以为死了","最后一面","没多久就走了"],
        contradiction: "方雨桐为揭露腐败消失三年，导致父亲在以为她已死亡的误解中离世，她错过了父亲最后一面，且这个误解至死都未能澄清。"
      }
    ],
    verdict: {
      correct: "功德超度",
      responses: {
        "功德超度": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "申请复议": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "S1": {
    id: "S1",
    grade: "S",
    name: "林建国",
    age: 52,
    cause_of_death: "心脏病发作",
    occupation: "公交车司机",
    registry_status: "正常",
    yct_grade: "C级",
    is_mainline: true,
    soul_bio: {
      personality: "平静，责任感强，不觉得自己做了什么了不起的事，对老乘客只是感慨缘分",
      known_info: "开了28年公交从未迟到，死亡当天撑完最后一程靠站后去世，23名乘客平安",
      hidden_info: "无——他自己也不知道那个老乘客的异常"
    },
    questions: [
      { id: "A", text: "描述一下你去世的经过。" },
      { id: "B", text: "你有什么遗憾吗？" },
      { id: "C", text: "死亡当天有没有什么印象深刻的事？" },
      { id: "D", text: "你这辈子有没有做过什么亏心事？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、坦然。无明显隐瞒或异常波动。此灵魂情绪真实可信。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "暂无线索可对比。",
    mainline_trigger: "⚠️ 档案异常：王秀珍，东城区居民。死亡日期：三年前。当前档案状态：有效在籍。死亡记录与在籍记录同时存在，档案存在冲突。",
    archive: [
      { source: "王秀珍（老乘客）", text: "我每周都坐那路车，认识那个司机，三年前我生病住院，后来……后来就没再坐了。", is_useful: true, triggers_mainline: true },
      { source: "同事老王", text: "他那天身体就不对了，我说让他请假，他说下一班没人顶，就撑着去了。", is_useful: false },
      { source: "乘客陈女士", text: "那天终点站到了，司机没开门，我们才发现他倒在座位上了。", is_useful: false },
      { source: "公交公司记录员", text: "林建国，驾龄28年，零事故记录，零迟到记录。", is_useful: false },
      { source: "女儿林小燕", text: "爸爸就是这样，从来不说自己不舒服，就知道上班。我说他，他说没事没事。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["老乘客","三年没见","又上来了","又见到"],
        clue_b_keywords: ["去世","没了","以为走了","死亡","在籍"],
        contradiction: "林建国提到三年前听说已去世的老乘客当天出现在车上，档案显示该乘客王秀珍死亡记录与在籍记录同时存在，档案出现客观冲突。"
      }
    ],
    verdict: {
      correct: "投胎",
      responses: {
        "投胎": { type: "correct", kpi: 2, text: "裁决正确。KPI +2。" },
        "申请复议": { type: "deviation", kpi: 1, text: "裁决存在偏差。林建国本人档案无异常。KPI +1。" },
        "功德超度": { type: "deviation", kpi: 1, text: "裁决存在偏差。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "S2": {
    id: "S2",
    grade: "S",
    name: "赵美玲",
    age: 34,
    cause_of_death: "交通意外",
    occupation: "便利店店员",
    registry_status: "正常",
    yct_grade: "B级",
    is_mainline: true,
    soul_bio: {
      personality: "克制，努力平静，一提女儿就情绪波动，对自己的死没有怨恨只有遗憾",
      known_info: "单亲妈妈，独自抚养七岁女儿，21:43离开便利店，步行约20分钟后在22:03被撞",
      hidden_info: "无——她自己不知道生死簿异常"
    },
    questions: [
      { id: "A", text: "描述一下你去世的经过。" },
      { id: "B", text: "你最放不下的是什么？" },
      { id: "C", text: "你几点离开便利店的？" },
      { id: "D", text: "从便利店到出事地点要走多久？" }
    ],
    spirit_sense: {
      result: "情绪状态：压抑的悲伤、深层的不甘。在回答B「女儿」时情绪强烈波动。其余回答情绪真实，未检测到刻意隐瞒。此人所说均为她所知道的真相。",
      unlocks_followup: false
    },
    followup: [],
    compare_clues: "⚠️ 档案异常：赵美玲实际死亡时间22:03与生死簿「应当死亡时间」21:45相差18分钟。应当死亡时间记录显示曾被系统管理员权限修改，原始记录已覆盖。",
    mainline_trigger: "⚠️ 档案异常：赵美玲应当死亡时间被人提前修改了18分钟。修改权限：系统管理员级别。原始记录已覆盖。",
    archive: [
      { source: "女儿", text: "妈妈那天打电话来，说快回来了，让我等她，然后就没等到。", is_useful: false },
      { source: "便利店同事", text: "她那天提前走了，说身体不舒服，我们说没事你先走吧，然后就听说出事了。", is_useful: true },
      { source: "生死簿系统记录员", text: "赵美玲档案，应当死亡时间：21:45，实际死亡时间：22:03，差值18分钟。修改记录：死亡前72小时，操作权限：系统管理员级别，原始数据已覆盖。", is_useful: true, triggers_mainline: true },
      { source: "路人目击者", text: "那辆车闯红灯，我看得很清楚，她在斑马线上，根本没办法躲。", is_useful: false },
      { source: "闯红灯司机", text: "我没有喝酒，就是走神了，我真的不是故意的。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["21:43","九点五十七","提早","三分钟"],
        clue_b_keywords: ["21:45","修改","提前","管理员","覆盖"],
        contradiction: "赵美玲实际离店时间与生死簿应当死亡时间相差18分钟，档案显示应当死亡时间曾被系统管理员权限提前修改，原始记录已被覆盖。"
      }
    ],
    verdict: {
      correct: "申请复议",
      responses: {
        "申请复议": { type: "correct", kpi: 2, text: "裁决正确。档案存在被修改的客观异常。KPI +2。" },
        "投胎": { type: "deviation", kpi: 1, text: "裁决存在偏差。忽视了档案修改痕迹。KPI +1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  },

  "S3": {
    id: "S3",
    grade: "S",
    name: "陈默",
    age: 29,
    cause_of_death: "意外溺亡",
    occupation: "图书管理员",
    registry_status: "⚠️ 异常",
    yct_grade: "A级",
    is_mainline: true,
    soul_bio: {
      personality: "安静，困惑，对自己为什么会在这里真的不知道，没有隐瞒只是不知情",
      known_info: "图书管理员，河边散步脚滑溺亡，死前三天有陌生男人来查地方志",
      hidden_info: "无——他自己也不知道自己不在死亡名单上"
    },
    questions: [
      { id: "A", text: "描述一下你去世的经过。" },
      { id: "B", text: "你生前是做什么工作的？" },
      { id: "C", text: "你有什么放不下的吗？" },
      { id: "D", text: "你知道自己为什么会在这里吗？" }
    ],
    spirit_sense: {
      result: "情绪状态：平静、茫然、无明显隐瞒。此灵魂对自身情况真的不知情。但感知到一处深层异常：此灵魂身上缺少「命数印记」——每个应当死亡的灵魂都携带此印记，陈默没有。",
      unlocks_followup: true
    },
    followup: [
      { question: "你死之前，生活有没有什么变化？", answer: "没有……都很普通。就是死前那天，有个人来图书馆，要查很老的地方志，我帮他找了。然后他走了。然后我去河边散步，然后就掉进去了。" },
      { question: "那个来查地方志的人，你还记得他的样子吗？", answer: "普通，四十多岁，黑色外套。他话不多，找到书之后道了谢就走了。……你问这个干什么？" }
    ],
    compare_clues: "⚠️ 严重档案异常：陈默死亡属实，但生死簿中完全没有他的死亡记录，他从未出现在任何应当死亡的名单上。本月同类情况已有3例并持续增加。",
    mainline_trigger: "⚠️ 严重异常：陈默从未出现在任何死亡名单上。地府系统对其死亡毫无预期。本月同类情况共3例，数量正在增加。",
    archive: [
      { source: "图书馆常客（描述陈默的猫）", text: "那只猫一直在门口等，等了好几天，没等到人回来。", is_useful: false },
      { source: "图书馆同事", text: "他死前几天，有个人来查地方志，我看见了，那人话不多，查完就走了，陈默帮他找的书。", is_useful: true },
      { source: "生死簿系统检索记录", text: "陈默，29岁，图书管理员。死亡事实：确认。生死簿记录：不存在。本月同类情况：3例。上月：1例。上上月：0例。数量正在增加。", is_useful: true, triggers_mainline: true },
      { source: "河边目击者", text: "我看见他走着走着脚一滑就掉进去了，我喊了人来，但还是没救上来。", is_useful: false },
      { source: "房东", text: "他是个安静的租客，从来不闹事，每个月准时交房租，就是养了一只猫。", is_useful: false }
    ],
    clue_pairs: [
      {
        clue_a_keywords: ["散步","脚滑","意外","溺亡"],
        clue_b_keywords: ["名单","不存在","没有记录","计划外","3例","增加"],
        contradiction: "陈默死亡属实，但生死簿中完全没有他的死亡记录，他从未出现在任何应当死亡的名单上，且本月同类情况已有3例并持续增加。"
      }
    ],
    verdict: {
      correct: "申请复议",
      responses: {
        "申请复议": { type: "correct", kpi: 2, text: "裁决正确。生死簿无此人记录，死亡属计划外，必须上报。KPI +2。" },
        "投胎": { type: "error", kpi: -1, text: "裁决有误。直接投胎将掩盖异常。KPI -1。" },
        "打入地狱": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" },
        "功德超度": { type: "error", kpi: -1, text: "裁决有误。KPI -1。" }
      }
    }
  }
};

const SAVE_KEY = 'yinjian_simulator_save';

interface CompareModalProps {
  gameState: GameState;
  slotA: Clue | null;
  slotB: Clue | null;
  setSlotA: (c: Clue | null) => void;
  setSlotB: (c: Clue | null) => void;
  setModal: (m: any) => void;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
}

const CompareModalContent = ({ 
  gameState, 
  slotA, 
  slotB, 
  setSlotA, 
  setSlotB, 
  setModal, 
  setGameState 
}: CompareModalProps) => {
  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  console.log('renderSlots执行，slotA:', slotA, 'slotB:', slotB);
  
  const handleContainerClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const item = target.closest('.clue-item') as HTMLElement;
    if (!item) return;
    
    const clueId = item.dataset.clueId;
    console.log(`点击了线索：[${clueId}]`);
    
    const clue = gameState.cluePool.find(c => c.id === clueId);
    if (!clue) return;

    if (!slotA) {
      setSlotA(clue);
      console.log('赋值后 slotA:', clue, 'slotB:', slotB);
    } else if (!slotB) {
      setSlotB(clue);
      console.log('赋值后 slotA:', slotA, 'slotB:', clue);
    } else {
      // Both full, replace slot A
      setSlotA(clue);
      console.log('赋值后 slotA:', clue, 'slotB:', slotB);
    }
  };

  const startCompare = () => {
    if (!slotA || !slotB || !gameState.currentCase) return;

    const pairs = gameState.currentCase.clue_pairs;
    let foundContradiction = "";

    for (const pair of pairs) {
      const aMatchesA = pair.clue_a_keywords.some(k => slotA.text.includes(k));
      const bMatchesB = pair.clue_b_keywords.some(k => slotB.text.includes(k));
      const aMatchesB = pair.clue_b_keywords.some(k => slotA.text.includes(k));
      const bMatchesA = pair.clue_a_keywords.some(k => slotB.text.includes(k));

      if ((aMatchesA && bMatchesB) || (aMatchesB && bMatchesA)) {
        foundContradiction = pair.contradiction;
        break;
      }
    }

    if (foundContradiction) {
      setFeedback({ text: `⚠️ 发现矛盾：${foundContradiction}`, type: 'success' });
      
      setGameState(prev => {
        const newDialogue = [...prev.dialogue];
        const newState = {
          ...prev,
          messages: [
            ...prev.messages,
            { id: Date.now().toString(), type: 'warning', text: `⚠️ 发现矛盾：${foundContradiction}` }
          ],
          notebook: [...prev.notebook, { label: "对比线索", content: foundContradiction }],
          toolsStatus: { ...prev.toolsStatus, compareCluesFound: true }
        };

        // Tutorial Step 5
        if (prev.tutorialStep === 5 && prev.currentCase?.id === "000") {
          newDialogue.push({ id: `tut-5-${Date.now()}`, type: 'yct', text: "「也可以查阅档案，\n调取与此人相关的灵魂记忆。」" });
          newState.tutorialStep = 6;
        }

        newState.dialogue = newDialogue;
        return newState;
      });
    } else {
      setFeedback({ text: "这两条线索暂时没有发现关联，再想想。", type: 'error' });
      
      setGameState(prev => ({
        ...prev,
        messages: [
          ...prev.messages,
          { id: Date.now().toString(), type: 'info', text: "这两条线索暂时没有发现关联，再想想。" }
        ]
      }));

      // Clear feedback after 3 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 3000);
    }
  };

  return (
    <div className="flex space-x-6 max-h-[600px]">
      {/* Left: Clue List */}
      <div 
        onClick={handleContainerClick}
        className="w-1/2 flex flex-col space-y-3 overflow-y-auto pr-2 custom-scrollbar max-h-[450px]"
      >
        <h4 className="text-xs font-bold text-nether-muted uppercase tracking-widest mb-2">线索池</h4>
        {gameState.cluePool.map(clue => {
          const isInSlotA = slotA?.id === clue.id;
          const isInSlotB = slotB?.id === clue.id;
          
          let borderClass = 'border-nether-border bg-black/20 hover:border-nether-accent/50';
          let indicator = null;

          if (isInSlotA) {
            borderClass = 'border-blue-400 bg-blue-400/10';
            indicator = <div className="absolute top-0 left-0 w-1 h-full bg-blue-400" />;
          } else if (isInSlotB) {
            borderClass = 'border-yellow-400 bg-yellow-400/10';
            indicator = <div className="absolute top-0 left-0 w-1 h-full bg-yellow-400" />;
          }

          return (
            <div
              key={clue.id}
              data-clue-id={clue.id}
              className={`clue-item text-left py-2 px-3 rounded border transition-all relative overflow-hidden min-h-[60px] cursor-pointer ${borderClass}`}
            >
              {indicator}
              <div className="text-[10px] text-nether-muted mb-1 font-mono uppercase tracking-tighter pointer-events-none">[{clue.source}]</div>
              <div className="text-xs text-nether-ink/80 leading-relaxed break-all pointer-events-none">
                {clue.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: Slots */}
      <div className="w-1/2 flex flex-col space-y-6 overflow-y-auto pr-1">
        <div className="space-y-4 flex-1">
          <h4 className="text-xs font-bold text-nether-muted uppercase tracking-widest">对比槽位</h4>
          <div className="space-y-4">
            {[slotA, slotB].map((slot, i) => (
              <div 
                key={i} 
                id={i === 0 ? 'slot-a' : 'slot-b'}
                className={`relative bg-black/40 border rounded-lg p-4 min-h-[120px] flex flex-col justify-center transition-all ${
                slot 
                  ? (i === 0 ? 'border-blue-400/50 bg-blue-400/5' : 'border-yellow-400/50 bg-yellow-400/5') 
                  : 'border-nether-border'
              }`}>
                {slot ? (
                  <>
                    <div className={`text-[10px] mb-1 font-bold ${i === 0 ? 'text-blue-400' : 'text-yellow-400'}`}>
                      [{slot.source}]
                    </div>
                    <div className="text-xs text-nether-ink/90 italic overflow-y-auto max-h-[120px] custom-scrollbar pr-1 break-all">
                      {slot.text}
                    </div>
                    <button 
                      onClick={() => i === 0 ? setSlotA(null) : setSlotB(null)}
                      className="absolute top-2 right-2 text-nether-muted hover:text-nether-red"
                    >
                      <UserPlus className="w-4 h-4 rotate-45" />
                    </button>
                  </>
                ) : (
                  <div className="text-center text-nether-muted/30 text-xs italic">槽位 {i === 0 ? 'A' : 'B'} 为空</div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="relative pb-12">
          <button 
            disabled={!slotA || !slotB}
            onClick={startCompare}
            className={`w-full py-4 rounded-lg font-bold tracking-widest transition-all ${
              slotA && slotB 
                ? 'bg-nether-accent text-nether-bg hover:bg-nether-accent/80' 
                : 'bg-nether-border text-nether-muted cursor-not-allowed'
            }`}
          >
            开始对比
          </button>
          <AnimatePresence>
            {feedback && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`absolute left-0 right-0 text-[13px] text-center p-2 mt-1 font-bold ${
                  feedback.type === 'success' ? 'text-yellow-500' : 'text-nether-ink/60'
                }`}
              >
                {feedback.text}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<GameScreen>('START');
  const [gameState, setGameState] = useState<GameState>({
    playerName: '',
    level: 1,
    stage: '试用期',
    stageKPI: 0,
    currentCase: null,
    dialogue: [],
    messages: [],
    notebook: [],
    cluePool: [],
    caseQueue: [],
    achievements: [],
    stageResults: [],
    toolsStatus: {
      inquiryUsed: false,
      spiritSenseUsed: false,
      followupActive: false,
      followupUsed: false,
      usedFollowupIndices: [],
      usedInquiryIds: [],
      compareCluesUnlocked: false,
      compareCluesFound: false,
      archiveViewed: false,
      verdictCompleted: false
    },
    tutorialStep: 0,
    totalFreeQuestions: 0,
    freeQuestionUnlocked: false,
    s_triggered: [false, false, false]
  });
  const [activeAchievement, setActiveAchievement] = useState<Achievement | null>(null);
  const [slotA, setSlotA] = useState<Clue | null>(null);
  const [slotB, setSlotB] = useState<Clue | null>(null);
  const [tempName, setTempName] = useState('');
  const [freeQuestion, setFreeQuestion] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [typingIndex, setTypingIndex] = useState(0);
  const [showContinueBtn, setShowContinueBtn] = useState(false);
  const [settlementData, setSettlementData] = useState<any>(null);
  const [promotionData, setPromotionData] = useState<any>(null);
  const [endingData, setEndingData] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [modal, setModal] = useState<{ title: string, content: ReactNode, onClose?: () => void } | null>(null);
  const dialogueRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of dialogue
  useEffect(() => {
    if (dialogueRef.current) {
      dialogueRef.current.scrollTop = dialogueRef.current.scrollHeight;
    }
  }, [gameState.dialogue]);

  // Start screen typewriter states
  const [startStep, setStartStep] = useState(0); // 0: system, 1: title, 2: subtitle, 3: buttons
  const [startTypingIndex, setStartTypingIndex] = useState(0);

  const START_SYSTEM = "[系统启动中]";
  const START_TITLE = "阴曹司法局 · 判官工作台";
  const START_SUBTITLE = "NETHERWORLD HR DEPARTMENT";

  // Generate case queue
  const generateCaseQueue = () => {
    const queue: string[] = [];
    
    // 试用期桶
    const trialHell = ["C-03", "C-08", "C-09"];
    const trialMerit = ["C-01", "C-02", "C-06", "C-07"];
    const trialRebirth = ["C-04", "C-05"];
    
    // 1. 试用期队列 (3个)
    const trialBuckets = {
      hell: ["C-03", "C-08", "C-09"],
      merit: ["C-01", "C-02", "C-06", "C-07"],
      rebirth: ["C-04", "C-05"]
    };
    
    const firstBucketType = Math.random() > 0.5 ? 'hell' : 'merit';
    const remainingTypes = ['hell', 'merit', 'rebirth'].filter(t => t !== firstBucketType);
    const secondBucketType = remainingTypes[Math.floor(Math.random() * remainingTypes.length)];
    const thirdBucketType = remainingTypes.find(t => t !== secondBucketType)!;
    
    const usedTrialIds: string[] = [];
    [firstBucketType, secondBucketType, thirdBucketType].forEach(type => {
      const bucket = trialBuckets[type as keyof typeof trialBuckets];
      const id = bucket[Math.floor(Math.random() * bucket.length)];
      queue.push(id);
      usedTrialIds.push(id);
    });

    // 2. 正式期前期 (C*1 + B*3)
    const remainingC = ["C-01", "C-02", "C-03", "C-04", "C-05", "C-06", "C-07", "C-08", "C-09"].filter(id => !usedTrialIds.includes(id));
    const earlyC = remainingC[Math.floor(Math.random() * remainingC.length)];
    
    const bMeritEarly = ["B-04", "B-07"];
    const bRebirthEarly = ["B-01", "B-02", "B-06"];
    const bHellEarly = ["B-03", "B-05", "B-08"];
    
    const bEarlyIds = [
      bMeritEarly[Math.floor(Math.random() * bMeritEarly.length)],
      bRebirthEarly[Math.floor(Math.random() * bRebirthEarly.length)],
      bHellEarly[Math.floor(Math.random() * bHellEarly.length)]
    ].sort(() => Math.random() - 0.5);
    
    const earlyOrdinary = [earlyC, ...bEarlyIds];
    queue.push(earlyOrdinary[0]);
    queue.push(earlyOrdinary[1]);
    queue.push(earlyOrdinary[2]);
    queue.push("S1");
    queue.push(earlyOrdinary[3]);

    // 3. 正式期中期 (B*2 + A*2)
    const usedBIds = bEarlyIds;
    const remainingB = ["B-01", "B-02", "B-03", "B-04", "B-05", "B-06", "B-07", "B-08"].filter(id => !usedBIds.includes(id));
    
    const getTwoDifferentB = () => {
      const buckets = [
        ["B-04", "B-07"], // Merit
        ["B-01", "B-02", "B-06"], // Rebirth
        ["B-03", "B-05", "B-08"] // Hell
      ].map(b => b.filter(id => remainingB.includes(id)));
      
      const availableBuckets = buckets.filter(b => b.length > 0);
      const selectedBuckets = availableBuckets.sort(() => Math.random() - 0.5).slice(0, 2);
      return selectedBuckets.map(b => b[Math.floor(Math.random() * b.length)]);
    };
    
    const bMidIds = getTwoDifferentB();
    
    const aMeritMid = ["A-05", "A-06"];
    const aRebirthMid = ["A-02", "A-03"];
    const aHellMid = ["A-01", "A-04"];
    
    const aMidIds = [
      aMeritMid[Math.floor(Math.random() * aMeritMid.length)],
      aRebirthMid[Math.floor(Math.random() * aRebirthMid.length)],
      aHellMid[Math.floor(Math.random() * aHellMid.length)]
    ].sort(() => Math.random() - 0.5).slice(0, 2);
    
    const midOrdinary = [...bMidIds, ...aMidIds].sort(() => Math.random() - 0.5);
    queue.push(midOrdinary[0]);
    queue.push(midOrdinary[1]);
    queue.push("S2");
    queue.push(midOrdinary[2]);
    queue.push(midOrdinary[3]);

    // 4. 正式期后期 (A*3)
    const usedAIds = aMidIds;
    const remainingA = ["A-01", "A-02", "A-03", "A-04", "A-05", "A-06"].filter(id => !usedAIds.includes(id));
    
    const aLateIds = remainingA.sort(() => Math.random() - 0.5).slice(0, 3);
    queue.push(aLateIds[0]);
    queue.push(aLateIds[1]);
    queue.push("S3");
    queue.push(aLateIds[2]);

    return queue;
  };

  // Toast helper
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const unlockAchievement = useCallback((id: string) => {
    setGameState(prev => {
      if (prev.achievements.includes(id)) return prev;
      
      const achievement = ACHIEVEMENTS.find(a => a.id === id);
      if (achievement) {
        setActiveAchievement(achievement);
        setTimeout(() => setActiveAchievement(null), 3000);
      }
      
      const newState = {
        ...prev,
        achievements: [...prev.achievements, id]
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(newState));
      return newState;
    });
  }, []);

  // Achievement: 不该知道的事
  useEffect(() => {
    if (gameState.s_triggered.every(v => v === true)) {
      unlockAchievement('forbidden_knowledge');
    }
  }, [gameState.s_triggered, unlockAchievement]);

  // Tutorial Step 0
  useEffect(() => {
    if (screen === 'GAME' && gameState.tutorialStep === 0 && gameState.currentCase?.id === "000") {
      setTimeout(() => {
        setGameState(prev => {
          if (prev.tutorialStep !== 0) return prev;
          return {
            ...prev,
            dialogue: [
              ...prev.dialogue,
              { id: `tut-0-${Date.now()}`, type: 'yct', text: "「点击下方按钮向灵魂提问。\n每个按钮对应一个调查方向。」" }
            ],
            tutorialStep: 1
          };
        });
      }, 1500);
    }
  }, [screen, gameState.tutorialStep, gameState.currentCase]);

  // Achievement: 刨根问底
  useEffect(() => {
    if (gameState.currentCase && screen === 'GAME') {
      const { spiritSenseUsed, followupUsed, compareCluesFound, archiveViewed } = gameState.toolsStatus;
      const freeInquiryUsed = gameState.dialogue.some(d => d.id.startsWith('fq-'));
      if (spiritSenseUsed && followupUsed && compareCluesFound && archiveViewed && freeInquiryUsed) {
        unlockAchievement('thorough');
      }
    }
  }, [gameState.toolsStatus, gameState.dialogue, screen, unlockAchievement]);

  // Auto-save current case state
  useEffect(() => {
    if (gameState.currentCase && screen === 'GAME') {
      const ccs: CurrentCaseState = {
        caseId: gameState.currentCase.id,
        dialogHistory: gameState.dialogue,
        clickedQuestions: gameState.toolsStatus.usedInquiryIds,
        toolsState: {
          spiritSenseDone: gameState.toolsStatus.spiritSenseUsed,
          followupDone: gameState.toolsStatus.followupUsed,
          compareCluesDone: gameState.toolsStatus.compareCluesFound,
          archiveViewed: gameState.toolsStatus.archiveViewed
        },
        followupUnlocked: gameState.toolsStatus.followupActive,
        compareUnlocked: gameState.toolsStatus.compareCluesUnlocked,
        slotA: slotA,
        slotB: slotB,
        cluePool: gameState.cluePool,
        notebook: gameState.notebook,
        verdictDone: gameState.toolsStatus.verdictCompleted
      };
      
      const stateToSave = { ...gameState, currentCaseState: ccs };
      localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
    }
  }, [gameState, slotA, slotB, screen]);

  // Start screen typewriter logic
  useEffect(() => {
    if (screen === 'START') {
      if (startStep === 0) {
        if (startTypingIndex < START_SYSTEM.length) {
          const timer = setTimeout(() => setStartTypingIndex(prev => prev + 1), 60);
          return () => clearTimeout(timer);
        } else {
          setTimeout(() => {
            setStartStep(1);
            setStartTypingIndex(0);
          }, 500);
        }
      } else if (startStep === 1) {
        if (startTypingIndex < START_TITLE.length) {
          const timer = setTimeout(() => setStartTypingIndex(prev => prev + 1), 80);
          return () => clearTimeout(timer);
        } else {
          setTimeout(() => {
            setStartStep(2);
            setStartTypingIndex(0);
          }, 400);
        }
      } else if (startStep === 2) {
        if (startTypingIndex < START_SUBTITLE.length) {
          const timer = setTimeout(() => setStartTypingIndex(prev => prev + 1), 40);
          return () => clearTimeout(timer);
        } else {
          setTimeout(() => setStartStep(3), 500);
        }
      }
    }
  }, [screen, startStep, startTypingIndex]);

  // Typewriter effect logic for opening
  useEffect(() => {
    if (screen === 'OPENING') {
      if (typingIndex < OPENING_TEXT.length) {
        const timer = setTimeout(() => {
          setTypingIndex(prev => prev + 1);
        }, 50);
        return () => clearTimeout(timer);
      } else {
        setShowContinueBtn(true);
      }
    }
  }, [screen, typingIndex]);

  // Load game
  const handleContinue = () => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      
      if (parsed.currentCaseState && !parsed.currentCaseState.verdictDone) {
        // Restore in-progress case
        const state = parsed;
        const ccs = state.currentCaseState;
        const currentCase = CASE_POOL[ccs.caseId];
        
        if (!currentCase) {
          setGameState(parsed);
          setScreen('GAME');
          return;
        }

        setGameState({
          ...state,
          currentCase,
          dialogue: ccs.dialogHistory,
          notebook: ccs.notebook,
          cluePool: ccs.cluePool,
          toolsStatus: {
            ...state.toolsStatus,
            archiveViewed: ccs.toolsState.archiveViewed,
            spiritSenseUsed: ccs.toolsState.spiritSenseDone,
            followupUsed: ccs.toolsState.followupDone,
            compareCluesFound: ccs.toolsState.compareCluesDone,
            followupActive: ccs.followupUnlocked,
            compareCluesUnlocked: ccs.compareUnlocked,
            usedInquiryIds: ccs.clickedQuestions,
            verdictCompleted: ccs.verdictDone
          }
        });
        setSlotA(ccs.slotA);
        setSlotB(ccs.slotB);
        setScreen('GAME');
        
        // Push YCT message
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            dialogue: [
              ...prev.dialogue,
              { id: `yct-restore-${Date.now()}`, type: 'yct', text: "「已恢复上次的调查进度。」" }
            ]
          }));
        }, 500);
      } else {
        setGameState(parsed);
        setScreen('GAME');
      }
    } else {
      showToast('暂无存档');
    }
  };

  // New game
  const startNewGame = () => {
    setScreen('CREATE');
  };

  // Create character
  const handleCreate = () => {
    if (!tempName.trim()) {
      showToast('请输入名字');
      return;
    }
    const reason = DEATH_REASONS[Math.floor(Math.random() * DEATH_REASONS.length)];
    
    if (reason === "下载了一个不明软件，连人带手机一起没了") {
      unlockAchievement('bizarre_death');
    }

    const firstCase = CASE_POOL["000"];
    const queue = generateCaseQueue();
    const newState: GameState = {
      ...gameState,
      playerName: tempName,
      deathReason: reason,
      currentCase: firstCase,
      caseQueue: queue,
      dialogue: [
        { id: 'rule-1', type: 'system', text: "「在开始之前，说明裁决规则。\n\n⚪ 投胎：此人善恶平淡或相抵，正常轮回。\n🔴 打入地狱：此人罪孽清晰，需接受惩罚后再轮回。\n🟢 功德超度：此人善行卓著，免去轮回直接超度。\n🟡 申请复议：此选项极少使用。仅当档案本身存在客观记录异常时适用，例如死亡时间矛盾、记录被人为修改等。道德判断模糊不是申请复议的理由，那是你作为判官的职责。\n\n明白了吗？开始你的第一个案件。」" },
        { id: 'init-1', type: 'soul', text: `[${firstCase.name}坐在你对面，神情平静]\n点击下方按钮开始询问。` }
      ],
      messages: [
        { id: '1', type: 'system', text: `新案件已送达。${firstCase.yct_grade}。请开始审查。` }
      ],
      notebook: [],
      cluePool: [],
      toolsStatus: {
        inquiryUsed: false,
        spiritSenseUsed: false,
        followupActive: false,
        followupUsed: false,
        usedFollowupIndices: [],
        usedInquiryIds: [],
        compareCluesUnlocked: false,
        compareCluesFound: false,
        archiveViewed: false,
        verdictCompleted: false
      },
      tutorialStep: 0,
      totalFreeQuestions: 0,
      freeQuestionUnlocked: false,
      s_triggered: [false, false, false]
    };

    // Initialize currentCaseState
    newState.currentCaseState = {
      caseId: firstCase.id,
      dialogHistory: newState.dialogue,
      clickedQuestions: [],
      toolsState: {
        spiritSenseDone: false,
        followupDone: false,
        compareCluesDone: false,
        archiveViewed: false
      },
      followupUnlocked: false,
      compareUnlocked: false,
      slotA: null,
      slotB: null,
      cluePool: [],
      notebook: [],
      verdictDone: false
    };

    setGameState(newState);
    localStorage.setItem(SAVE_KEY, JSON.stringify(newState));
    setScreen('OPENING');
    setTypingIndex(0);
    setShowContinueBtn(false);
  };

  // Save game helper
  const saveGame = useCallback((state: GameState) => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }, []);

  // Data Storage Helpers
  const addToCluePool = useCallback((id: string, source: string, text: string) => {
    setGameState(prev => {
      const filteredPool = prev.cluePool.filter(c => c.id !== id);
      const newPool = [...filteredPool, { id, source, text }];
      console.log("Current Clue Pool:", newPool);
      return {
        ...prev,
        cluePool: newPool
      };
    });
  }, []);

  const addToNotebook = useCallback((label: string, content: string) => {
    setGameState(prev => ({
      ...prev,
      notebook: [...prev.notebook, { label, content }]
    }));
  }, []);

  const handleInquiry = async (id: string, question: string) => {
    if (isAiThinking || !gameState.currentCase) return;

    // Achievement: 青天大老爷
    const count = gameState.toolsStatus.usedInquiryIds.filter(qid => qid === id).length;
    if (count >= 4) {
      unlockAchievement('honest_judge');
    }

    // Tutorial Step 1
    if (gameState.tutorialStep === 1 && gameState.currentCase?.id === "000") {
      setGameState(prev => ({
        ...prev,
        dialogue: [
          ...prev.dialogue,
          { id: `tut-1-${Date.now()}`, type: 'yct', text: "「继续询问灵魂，将四个方向都问一遍，\n再使用灵力感知判断情绪状态。」" }
        ],
        tutorialStep: 2
      }));
    }

    const isRepeat = gameState.toolsStatus.usedInquiryIds.includes(id);
    setIsAiThinking(true);

    // Add player question to dialogue immediately
    setGameState(prev => ({
      ...prev,
      dialogue: [
        ...prev.dialogue,
        { id: `q-${Date.now()}`, type: 'player', text: question }
      ]
    }));

    try {
      const { name, age, occupation, soul_bio } = gameState.currentCase;
      let systemInstruction = `你是地府判官游戏中的一个灵魂角色。
姓名：${name}
年龄：${age}
生前职业：${occupation}
性格特征：${soul_bio.personality}
你知道的信息：${soul_bio.known_info}
你隐瞒的信息：${soul_bio.hidden_info}

规则：
1. 用第一人称回答，保持角色性格
2. 给出有效但可能不完整的回答
3. 回答控制在80字以内
4. 不要主动透露隐瞒的信息
5. 纯文本，不使用markdown格式`;

      if (isRepeat) {
        systemInstruction += `\n\n玩家已经问过这个问题了。给出符合你性格的无意义重复回应，表现出不耐烦、委屈或坚持，控制在30字以内。`;
      }

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: question }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        }
      });

      const answer = response.text || "……（灵魂陷入了沉默，似乎不想回答这个问题）";

      setGameState(prev => {
        const updatedUsedInquiryIds = [...prev.toolsStatus.usedInquiryIds, id];
        const allInquiriesUsed = prev.currentCase?.questions.every(q => updatedUsedInquiryIds.includes(q.id));
        const wasSpiritSenseLocked = !prev.toolsStatus.inquiryUsed;
        
        const newMessages = [...prev.messages];
        const newDialogue = [
          ...prev.dialogue,
          { id: `a-${Date.now() + 1}`, type: 'soul', text: answer }
        ];
        let newTutorialStep = prev.tutorialStep;

        // Tutorial Step 2: Triggered when all 4 inquiries are clicked
        if (prev.tutorialStep === 2 && prev.currentCase?.id === "000" && allInquiriesUsed) {
          newDialogue.push({ 
            id: `tut-2-${Date.now()}`, 
            type: 'yct', 
            text: "「很好。现在全部询问已完成，\n可以使用灵力感知判断灵魂的情绪状态。试试看。」" 
          });
          newTutorialStep = 3;
        }

        if (allInquiriesUsed && wasSpiritSenseLocked) {
          newMessages.push({ id: `unlock-${Date.now()}`, type: 'info', text: "灵力感知已解锁。" });
        }

        return {
          ...prev,
          dialogue: newDialogue,
          messages: newMessages,
          tutorialStep: newTutorialStep,
          toolsStatus: {
            ...prev.toolsStatus,
            inquiryUsed: allInquiriesUsed || prev.toolsStatus.inquiryUsed,
            usedInquiryIds: updatedUsedInquiryIds
          }
        };
      });
      
      if (!isRepeat) {
        addToCluePool(id, id, answer);
        addToNotebook(id, answer);
      }

    } catch (error) {
      console.error("AI Error:", error);
      setGameState(prev => ({
        ...prev,
        dialogue: [
          ...prev.dialogue,
          { id: `fa-err-${Date.now()}`, type: 'soul', text: "……（灵魂的波动变得剧烈，无法维持对话）" }
        ]
      }));
    } finally {
      setIsAiThinking(false);
    }
  };

  // Tool Actions
  const handleSpiritSense = () => {
    if (gameState.toolsStatus.spiritSenseUsed || !gameState.currentCase || !gameState.toolsStatus.inquiryUsed) return;
    
    const senseResult = gameState.currentCase.spirit_sense.result;
    const newMessages: Message[] = [
      ...gameState.messages,
      { id: Date.now().toString(), type: 'warning', text: senseResult },
      { id: (Date.now() + 1).toString(), type: 'info', text: "感知完成。追问、查阅档案已解锁。" }
    ];

    setGameState(prev => {
      const newState = {
        ...prev,
        messages: newMessages,
        toolsStatus: {
          ...prev.toolsStatus,
          spiritSenseUsed: true
        }
      };

      // Tutorial Step 3
      if (prev.tutorialStep === 3 && prev.currentCase?.id === "000") {
        newState.dialogue = [
          ...prev.dialogue,
          { id: `tut-3-${Date.now()}`, type: 'yct', text: "「感知结果显示异常。\n点击追问，针对异常点深入追问。」" }
        ];
        newState.tutorialStep = 4;
      }

      return newState;
    });

    addToCluePool("灵力感知", "灵力感知", senseResult);
    addToNotebook("灵力感知", senseResult);
  };

  const handleFollowup = () => {
    if (!gameState.toolsStatus.spiritSenseUsed || !gameState.currentCase || gameState.toolsStatus.followupActive) return;

    setGameState(prev => {
      const newState = {
        ...prev,
        dialogue: [
          ...prev.dialogue,
          { id: `sys-${Date.now()}`, type: 'system', text: "[可追问的方向已解锁，请选择追问内容]" }
        ],
        toolsStatus: {
          ...prev.toolsStatus,
          followupActive: true
        }
      };

      // Tutorial Step 4
      if (prev.tutorialStep === 4 && prev.currentCase?.id === "000") {
        newState.dialogue.push({ id: `tut-4-${Date.now()}`, type: 'yct', text: "「现在可以对比线索，\n看看灵魂的陈述和档案是否一致。」" });
        newState.tutorialStep = 5;
      }

      return newState;
    });
  };

  const handleFollowupSelect = (index: number) => {
    if (!gameState.currentCase) return;
    const f = gameState.currentCase.followup[index];
    const label = index === 0 ? "追问一" : "追问二";
    const text = `问：${f.question}\n答：${f.answer}`;

    setGameState(prev => {
      const currentUsed = prev.toolsStatus.usedFollowupIndices || [];
      const newUsed = [...currentUsed, index];
      const allUsed = newUsed.length === (prev.currentCase?.followup.length || 0);
      const isFirstFollowup = currentUsed.length === 0;
      const newMessages = [...prev.messages];

      if (isFirstFollowup) {
        newMessages.push({ id: `unlock-${Date.now()}`, type: 'info', text: "对比线索已解锁。" });
      }

      return {
        ...prev,
        dialogue: [
          ...prev.dialogue,
          { id: `fq-${Date.now()}`, type: 'followup_option', text: f.question },
          { id: `fa-${Date.now() + 1}`, type: 'soul', text: f.answer }
        ],
        messages: newMessages,
        toolsStatus: {
          ...prev.toolsStatus,
          usedFollowupIndices: newUsed,
          followupUsed: allUsed,
          compareCluesUnlocked: true
        }
      };
    });

    addToCluePool(label, label, text);
    addToNotebook(label, text);
  };

  const handleFreeInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freeQuestion.trim() || isAiThinking || !gameState.currentCase || !gameState.freeQuestionUnlocked) return;

    const question = freeQuestion.trim();
    setFreeQuestion('');
    setIsAiThinking(true);

    // Add player question to dialogue immediately
    setGameState(prev => {
      const newTotal = prev.totalFreeQuestions + 1;
      if (newTotal > 10) {
        unlockAchievement('curious_cat');
      }
      return {
        ...prev,
        totalFreeQuestions: newTotal,
        dialogue: [
          ...prev.dialogue,
          { id: `fq-${Date.now()}`, type: 'player', text: question }
        ]
      };
    });

    try {
      const systemInstruction = `
        你现在正在扮演一个名为「${gameState.currentCase.name}」的死者灵魂，正在接受判官的审讯。
        你的基本信息：
        - 姓名：${gameState.currentCase.name}
        - 年龄：${gameState.currentCase.age}
        - 职业：${gameState.currentCase.occupation}
        - 死因：${gameState.currentCase.cause_of_death}
        
        你的性格特征：${gameState.currentCase.soul_bio.personality}
        
        背景秘密（不要直接说出来，除非被问到痛点或追问）：
        ${gameState.currentCase.clue_pairs[0].contradiction}
        
        回复要求：
        1. 语气要符合你的身份和性格。
        2. 说话要简短，通常在2-3句话以内。
        3. 如果判官问到你的秘密，你可以试图回避或含糊其辞，除非他拿出了确凿的证据或进行了深入追问。
        4. 保持一种阴森、虚弱但真实的感觉。
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: question }] }
        ],
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.8,
        }
      });

      const answer = response.text || "……（灵魂陷入了沉默，似乎不想回答这个问题）";

      setGameState(prev => ({
        ...prev,
        dialogue: [
          ...prev.dialogue,
          { id: `fa-${Date.now()}`, type: 'soul', text: answer }
        ]
      }));

      // Add to clue pool and notebook
      const id = `自由提问-${Date.now()}`;
      addToCluePool(id, "自由提问", answer);
      addToNotebook("自由提问", `问：${question}\n答：${answer}`);

    } catch (error) {
      console.error("AI Error:", error);
      setGameState(prev => ({
        ...prev,
        dialogue: [
          ...prev.dialogue,
          { id: `fa-err-${Date.now()}`, type: 'soul', text: "……（灵魂的波动变得剧烈，无法维持对话）" }
        ]
      }));
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleCompareClues = () => {
    if (!gameState.toolsStatus.compareCluesUnlocked || !gameState.currentCase) return;

    if (gameState.toolsStatus.compareCluesFound) {
      const conclusion = gameState.notebook.find(n => n.label === '对比线索')?.content;
      setModal({
        title: "对比线索",
        content: <div className="font-serif-sc text-lg leading-relaxed">{conclusion}</div>
      });
      return;
    }

    console.log(`线索池共${gameState.cluePool.length}条，渲染完成`);

    setModal({
      title: "对比线索",
      content: null,
      onClose: () => {
        setSlotA(null);
        setSlotB(null);
        setModal(null);
      }
    });
  };

  const handleVerdict = (option: string) => {
    if (!gameState.currentCase || gameState.toolsStatus.verdictCompleted) return;

    setModal({
      title: "确认裁决",
      content: (
        <div className="space-y-6">
          <p className="text-lg font-serif-sc">确认对灵魂「{gameState.currentCase.name}」执行裁决：<span className="text-nether-accent">[{option}]</span>？</p>
          <div className="flex space-x-4">
            <button 
              onClick={() => executeVerdict(option)}
              className="flex-1 py-3 bg-nether-accent/20 border border-nether-accent/50 text-nether-accent rounded hover:bg-nether-accent/30 transition-all font-bold"
            >
              确认
            </button>
            <button 
              onClick={() => setModal(null)}
              className="flex-1 py-3 bg-white/5 border border-white/10 text-nether-muted rounded hover:bg-white/10 transition-all"
            >
              取消
            </button>
          </div>
        </div>
      )
    });
  };

  const executeVerdict = (option: string) => {
    if (!gameState.currentCase) return;
    const response = gameState.currentCase.verdict.responses[option];
    if (!response) return;

    const typeMap: Record<string, 'system' | 'info' | 'warning'> = {
      correct: 'system',
      deviation: 'info',
      error: 'warning'
    };

    setGameState(prev => {
      const nextResults = [
        ...prev.stageResults,
        { case: prev.currentCase!.id, verdict: option, type: response.type, kpi: response.kpi }
      ];
      
      const newState = {
        ...prev,
        stageKPI: prev.stageKPI + response.kpi,
        stageResults: nextResults,
        messages: [
          ...prev.messages,
          { id: `verdict-${Date.now()}`, type: typeMap[response.type], text: response.text }
        ],
        toolsStatus: {
          ...prev.toolsStatus,
          verdictCompleted: true
        }
      };

      // Tutorial Step 7
      if (prev.tutorialStep === 7 && prev.currentCase?.id === "000") {
        newState.dialogue = [
          ...newState.dialogue,
          { id: `tut-7-${Date.now()}`, type: 'yct', text: "「引导完成。现在已解锁自由提问功能，\n你可以尝试输入任何问题来审讯灵魂。」" }
        ];
        newState.tutorialStep = 8;
        newState.freeQuestionUnlocked = true;
        unlockAchievement('tutorial_complete');
      }

      // Achievement: 史上最短命的判官 & 法外狂徒
      const recentResults = nextResults.slice(-3);
      if (recentResults.length === 3 && recentResults.every(r => r.type === 'error')) {
        unlockAchievement('outlaw');
        if (newState.stage !== '试用期') {
          unlockAchievement('short_lived');
        }
      }

      // Auto-save
      localStorage.setItem(SAVE_KEY, JSON.stringify(newState));

      return newState;
    });

    // S-class Mainline Logic
    if (gameState.currentCase.id === "S1") {
      setGameState(prev => ({
        ...prev,
        s_triggered: [true, prev.s_triggered[1], prev.s_triggered[2]],
        notebook: [...prev.notebook, { 
          label: "主线记录", 
          content: "王秀珍，东城区。\n死亡记录和在籍记录同时存在。\n可能是系统错误。" 
        }]
      }));
    } else if (gameState.currentCase.id === "S2") {
      setGameState(prev => ({
        ...prev,
        s_triggered: [prev.s_triggered[0], true, prev.s_triggered[2]],
        notebook: [...prev.notebook, { 
          label: "主线记录", 
          content: "赵美玲，生死簿应当死亡时间\n被人提前修改了18分钟。\n修改权限：系统管理员级别。\n复议被驳回。\n\n王秀珍——死亡记录和在籍记录并存。\n赵美玲——死亡时间被人改过。\n两个案件，都有人动过档案。" 
        }]
      }));

      if (option === "申请复议") {
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            messages: [...prev.messages, { id: `s2-msg-1-${Date.now()}`, type: 'info', text: "复议申请已提交。等待上级回复……" }]
          }));
        }, 500);
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            messages: [...prev.messages, { id: `s2-msg-2-${Date.now()}`, type: 'warning', text: "上级回复：驳回。正常结案。" }]
          }));
        }, 2000);
      }
    } else if (gameState.currentCase.id === "S3") {
      setGameState(prev => ({
        ...prev,
        s_triggered: [prev.s_triggered[0], prev.s_triggered[1], true],
        notebook: [...prev.notebook, { 
          label: "主线记录", 
          content: "王秀珍——死亡记录和在籍记录并存。\n赵美玲——死亡时间被提前修改。\n陈默——根本不在死亡名单上，却死了。\n本月同类情况共3例，还在增加。\n\n有人在同时操控生死和死亡名单。\n幕后是谁，我还不知道。\n但阴曹通说——\n这个月只有陈默的复议被批准了。" 
        }]
      }));

      if (option === "申请复议") {
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            messages: [...prev.messages, { id: `s3-msg-1-${Date.now()}`, type: 'info', text: "复议申请已提交。等待上级回复……" }]
          }));
        }, 500);
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            messages: [...prev.messages, { id: `s3-msg-2-${Date.now()}`, type: 'system', text: "上级回复：……批准。" }]
          }));
        }, 2500);
        setTimeout(() => {
          setGameState(prev => ({
            ...prev,
            messages: [...prev.messages, { id: `s3-msg-3-${Date.now()}`, type: 'system', text: "这个月第一个被批准的复议。" }],
            dialogue: [
              ...prev.dialogue,
              { id: `s3-end-${Date.now()}`, type: 'soul', text: "[陈默离开前转身]\n那个查地方志的人，\n他查的是东城区，\n1990年到2000年的人口记录。\n我不知道有没有用。" }
            ]
          }));
        }, 3500);
      }
    }

    setModal(null);
    showToast("裁决已执行");
  };

  const handleNextCase = () => {
    const totalCompleted = gameState.stageResults.length;
    
    // Check for settlement
    // totalCompleted: 1 (000), 4 (Trial), 9 (Early), 14 (Mid), 18 (Late)
    if (totalCompleted === 4 && gameState.stage === '试用期') {
      triggerSettlement('试用期');
      return;
    } else if (totalCompleted === 9 && gameState.stage === '正式期·前期') {
      triggerSettlement('正式期·前期');
      return;
    } else if (totalCompleted === 14 && gameState.stage === '正式期·中期') {
      triggerSettlement('正式期·中期');
      return;
    } else if (totalCompleted === 18 && gameState.stage === '正式期·后期') {
      triggerSettlement('正式期·后期');
      return;
    }

    if (gameState.caseQueue.length === 0) {
      showToast("所有案件已审理完毕");
      return;
    }

    const nextQueue = [...gameState.caseQueue];
    const nextId = nextQueue.shift();
    if (!nextId) return;

    const nextCase = CASE_POOL[nextId];

    setGameState(prev => {
      const newState: GameState = {
        ...prev,
        currentCase: nextCase,
        caseQueue: nextQueue,
        dialogue: [
          { id: `init-${Date.now()}`, type: 'soul', text: `[${nextCase.name}坐在你对面，神情平静]\n点击下方按钮开始询问。` }
        ],
        messages: [
          { id: `msg-${Date.now()}`, type: 'system', text: `新案件已送达。${nextCase.yct_grade}。请开始审查。` }
        ],
        notebook: [],
        cluePool: [],
        toolsStatus: {
          inquiryUsed: false,
          spiritSenseUsed: false,
          followupActive: false,
          followupUsed: false,
          usedFollowupIndices: [],
          usedInquiryIds: [],
          compareCluesUnlocked: false,
          compareCluesFound: false,
          archiveViewed: false,
          verdictCompleted: false
        }
      };

      // Initialize currentCaseState for next case
      newState.currentCaseState = {
        caseId: nextCase.id,
        dialogHistory: newState.dialogue,
        clickedQuestions: [],
        toolsState: {
          spiritSenseDone: false,
          followupDone: false,
          compareCluesDone: false,
          archiveViewed: false
        },
        followupUnlocked: false,
        compareUnlocked: false,
        slotA: null,
        slotB: null,
        cluePool: [],
        notebook: [],
        verdictDone: false
      };

      localStorage.setItem(SAVE_KEY, JSON.stringify(newState));
      return newState;
    });
    setSlotA(null);
    setSlotB(null);
    setTypingIndex(0);
    showToast("加载下一案件...");
  };

  const triggerSettlement = (stage: string) => {
    const results = gameState.stageResults;
    let stageResultsSlice: any[] = [];
    
    if (stage === '试用期') {
      stageResultsSlice = results.slice(1, 4); // Cases 2, 3, 4
    } else if (stage === '正式期·前期') {
      stageResultsSlice = results.slice(4, 9);
    } else if (stage === '正式期·中期') {
      stageResultsSlice = results.slice(9, 14);
    } else if (stage === '正式期·后期') {
      stageResultsSlice = results.slice(14, 18);
    }

    const correct = stageResultsSlice.filter(r => r.type === 'correct').length;
    const deviation = stageResultsSlice.filter(r => r.type === 'deviation').length;
    const error = stageResultsSlice.filter(r => r.type === 'error').length;
    const kpi = stageResultsSlice.reduce((sum, r) => sum + r.kpi, 0);

    let passed = false;
    if (stage === '试用期') {
      passed = error <= 1;
      if (!passed) unlockAchievement('archive_master');
    } else if (stage === '正式期·前期') {
      passed = kpi >= 6;
      if (!passed) unlockAchievement('mediocre');
    } else if (stage === '正式期·中期') {
      passed = kpi >= 6;
      if (!passed) unlockAchievement('mediocre');
    } else if (stage === '正式期·后期') {
      passed = kpi >= 5;
      if (!passed) unlockAchievement('mediocre');
    }

    setSettlementData({
      stage,
      correct,
      deviation,
      error,
      kpi,
      passed,
      target: stage === '试用期' ? '错误裁决 <= 1' : `KPI >= ${stage === '正式期·后期' ? 5 : 6}`
    });
    setScreen('SETTLEMENT');
  };

  const handleSettlementContinue = () => {
    if (!settlementData.passed) {
      // Game Over / Fail
      setEndingData({
        type: settlementData.stage === '试用期' ? '转岗' : '碌碌无为',
        achievement: settlementData.stage === '试用期' ? '最适合归档的人' : '碌碌无为'
      });
      setScreen('ENDING');
      return;
    }

    // Promotion
    let nextLevel = gameState.level + 1;
    let nextStageName = '';
    let nextTitle = '';

    if (settlementData.stage === '试用期') {
      nextStageName = '正式期·前期';
      nextTitle = '见习判官（Lv2）';
    } else if (settlementData.stage === '正式期·前期') {
      nextStageName = '正式期·中期';
      nextTitle = '判官（Lv3）';
    } else if (settlementData.stage === '正式期·中期') {
      nextStageName = '正式期·后期';
      nextTitle = '资深判官（Lv4）';
    } else if (settlementData.stage === '正式期·后期') {
      // Final Ending
      const totalCorrect = gameState.stageResults.filter(r => r.type === 'correct').length;
      const allCorrect = gameState.stageResults.every(r => r.type === 'correct');
      
      if (allCorrect) unlockAchievement('emotionless');
      unlockAchievement('old_timer');

      setEndingData({
        type: '第一章·终',
        totalCases: gameState.stageResults.length,
        totalCorrect,
        achievement: allCorrect ? '毫无感情的裁决机器' : '地府老油条'
      });
      setScreen('ENDING');
      return;
    }

    setPromotionData({
      title: nextTitle,
      nextStage: nextStageName
    });

    setGameState(prev => {
      const newState = {
        ...prev,
        level: nextLevel,
        stage: nextStageName,
        achievements: Array.from(new Set([...prev.achievements, settlementData.stage + '达标']))
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  const startNextStage = () => {
    setPromotionData(null);
    setSettlementData(null);
    setScreen('GAME');
    handleNextCase();
  };

  const restartGame = () => {
    localStorage.removeItem(SAVE_KEY);
    window.location.reload();
  };

  const handleArchive = () => {
    if (!gameState.currentCase) return;

    const hasMainlineTrigger = gameState.currentCase.is_mainline && 
                               gameState.currentCase.archive.some(a => a.triggers_mainline);

    const content = (
      <div className="space-y-6">
        <div className="space-y-6">
          {gameState.currentCase.archive.map((a, i) => (
            <div key={i} className="space-y-3 pb-6 border-b border-nether-border last:border-0">
              <div className="text-xs text-nether-muted tracking-widest uppercase">——来自 [{a.source}] 的记忆片段——</div>
              <div className="text-lg font-serif-sc leading-relaxed text-nether-ink/90">「{a.text}」</div>
            </div>
          ))}
        </div>
        
        {hasMainlineTrigger && gameState.currentCase.mainline_trigger && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-nether-red/10 border border-nether-red/30 rounded-lg"
          >
            <div className="text-xs text-nether-red font-bold uppercase tracking-widest mb-1">⚠️ 异常警告</div>
            <div className="text-sm text-nether-red/90 font-serif-sc italic">
              {gameState.currentCase.mainline_trigger}
            </div>
          </motion.div>
        )}
      </div>
    );

    setModal({ title: "档案 · 灵魂记忆调取", content });

    setGameState(prev => {
      const messages = [...prev.messages];
      if (hasMainlineTrigger && prev.currentCase?.mainline_trigger) {
        messages.push({
          id: `mainline-msg-${Date.now()}`,
          type: 'warning',
          text: prev.currentCase.mainline_trigger
        });
      }

      const newState = {
        ...prev,
        messages,
        toolsStatus: {
          ...prev.toolsStatus,
          archiveViewed: true
        }
      };

      // Tutorial Step 6
      if (prev.tutorialStep === 6 && prev.currentCase?.id === "000") {
        newState.dialogue = [
          ...prev.dialogue,
          { id: `tut-6-${Date.now()}`, type: 'yct', text: "「收集完毕，做出你的裁决。」" }
        ];
        newState.tutorialStep = 7;
      }

      return newState;
    });

    gameState.currentCase.archive.forEach(a => {
      const id = `档案·${a.source}`;
      addToCluePool(id, id, a.text);
    });
  };

  const handleNotebook = () => {
    const content = (
      <div className="space-y-4">
        {gameState.notebook.length === 0 ? (
          <div className="text-center py-12 text-nether-muted italic">暂无记录</div>
        ) : (
          gameState.notebook.map((n, i) => (
            <div key={i} className="bg-black/20 p-4 rounded border border-nether-border">
              <div className="text-[10px] text-nether-accent uppercase mb-1">[{n.label}]</div>
              <div className="text-sm text-nether-ink/80 whitespace-pre-wrap">{n.content}</div>
            </div>
          ))
        )}
      </div>
    );

    setModal({ title: `手册记录 · ${gameState.currentCase?.name || '未知'}`, content });
  };

  // Screen: Start
  const StartScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-4 space-y-12 font-mono"
    >
      <div className="text-center space-y-4 min-h-[160px] flex flex-col justify-center">
        {/* System Line */}
        <div className="h-6 text-nether-accent/60 text-sm tracking-widest">
          {startStep >= 0 && START_SYSTEM.slice(0, startStep > 0 ? START_SYSTEM.length : startTypingIndex)}
          {startStep === 0 && <span className="typewriter-cursor"></span>}
        </div>

        {/* Main Title */}
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-nether-ink">
          {startStep >= 1 && START_TITLE.slice(0, startStep > 1 ? START_TITLE.length : startTypingIndex)}
          {startStep === 1 && <span className="typewriter-cursor"></span>}
        </h1>

        {/* Subtitle */}
        <div className="h-6 text-nether-muted tracking-[0.3em] text-xs md:text-sm uppercase">
          {startStep >= 2 && START_SUBTITLE.slice(0, startStep > 2 ? START_SUBTITLE.length : startTypingIndex)}
          {startStep === 2 && <span className="typewriter-cursor"></span>}
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: startStep === 3 ? 1 : 0 }}
        className="flex flex-col space-y-4 w-full max-w-xs"
      >
        <MenuButton icon={<Play className="w-5 h-5" />} label="新游戏" onClick={startNewGame} />
        <MenuButton icon={<Save className="w-5 h-5" />} label="继续存档" onClick={handleContinue} />
        <MenuButton icon={<Trophy className="w-5 h-5" />} label="成就" onClick={() => setScreen('ACHIEVEMENTS')} />
      </motion.div>
    </motion.div>
  );

  // Screen: Create
  const CreateScreen = (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-4"
    >
      <div className="bg-nether-btn border border-nether-border p-8 rounded-lg w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <UserPlus className="w-12 h-12 mx-auto text-nether-accent" />
          <h2 className="text-2xl font-bold text-nether-ink">灵魂登记</h2>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-nether-muted ml-1">请输入你的名字</label>
            <input 
              type="text" 
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              className="w-full bg-black/20 border border-nether-border rounded-lg px-4 py-3 text-nether-ink focus:outline-none focus:border-nether-accent transition-colors font-mono"
              placeholder="张三"
              autoFocus
            />
          </div>
          <button 
            onClick={handleCreate}
            className="w-full bg-nether-accent text-nether-bg font-bold py-3 rounded-lg hover:bg-nether-accent/80 transition-all active:scale-95"
          >
            开始
          </button>
        </div>
      </div>
    </motion.div>
  );

  // Screen: Opening
  const OpeningScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-8"
    >
      <div className="max-w-2xl w-full bg-nether-btn border border-nether-border p-12 rounded-lg shadow-2xl relative">
        <ScrollText className="absolute -top-6 -left-6 w-12 h-12 text-nether-accent/30" />
        <pre className="whitespace-pre-wrap font-serif-sc text-lg md:text-xl leading-relaxed tracking-wide min-h-[400px] text-nether-ink/90">
          {OPENING_TEXT.slice(0, typingIndex)}
          {typingIndex < OPENING_TEXT.length && <span className="typewriter-cursor"></span>}
        </pre>
        
        <AnimatePresence>
          {showContinueBtn && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 flex justify-end"
            >
              <button 
                onClick={() => setScreen('WELCOME')}
                className="flex items-center space-x-2 text-nether-accent border border-nether-accent/30 px-6 py-2 rounded-full hover:bg-nether-accent/10 transition-all"
              >
                <span>继续</span>
                <Play className="w-4 h-4 fill-current" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );

  // Screen: Welcome
  const WelcomeScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center min-h-screen p-4"
    >
      <div className="w-full max-w-lg space-y-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-nether-accent rounded-full flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-nether-bg" />
          </div>
          <div>
            <h3 className="font-bold text-nether-accent">阴曹通 (Yin-Chat)</h3>
            <p className="text-xs text-nether-muted">在线 · 正在核查档案</p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-nether-btn border border-nether-border p-4 rounded-2xl rounded-tl-none max-w-[90%] relative"
        >
          <div className="text-nether-accent text-sm mb-2 font-bold">系统通知</div>
          <div className="space-y-2 text-nether-ink/90 leading-relaxed font-mono text-sm">
            <p>检测到新灵魂登录。</p>
            <p>正在核查档案……</p>
            <p>姓名：<span className="text-nether-accent">{gameState.playerName}</span></p>
            <p>死亡原因：<span className="text-nether-red">{gameState.deathReason}</span></p>
            <div className="h-px bg-nether-border my-4" />
            <p>档案核查完毕。</p>
            <p>由于本月案件积压严重</p>
            <p>您被临时征用为编外判官实习生</p>
            <p>合同已自动签署</p>
            <p>如有异议请联系——</p>
            <p className="text-nether-muted">[异议通道正在维护中]</p>
            <p className="mt-4 font-bold text-nether-accent">欢迎加入阴曹司法局。</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
          className="flex justify-center mt-12"
        >
          <button 
            onClick={() => {
              saveGame(gameState);
              setScreen('GAME');
            }}
            className="bg-nether-accent text-nether-bg px-12 py-3 rounded-full font-bold hover:bg-nether-accent/80 transition-all"
          >
            进入地府
          </button>
        </motion.div>
      </div>
    </motion.div>
  );

  // Screen: Game (Main Desk)
  const SettlementScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-nether-bg flex items-center justify-center p-6 z-[100]"
    >
      <div className="max-w-md w-full bg-black/40 border border-nether-border p-8 rounded-2xl space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-nether-accent/50 to-transparent"></div>
        
        <div className="text-center space-y-2">
          <div className="text-xs text-nether-muted tracking-[0.5em] uppercase">Stage Settlement</div>
          <h2 className="text-3xl font-serif-sc tracking-widest text-nether-ink">{settlementData?.stage} · 结算</h2>
        </div>

        <div className="space-y-4 py-6 border-y border-nether-border/50">
          <div className="flex justify-between items-center text-sm">
            <span className="text-nether-muted">正确裁决</span>
            <span className="text-nether-accent font-mono">{settlementData?.correct} 个</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-nether-muted">偏差裁决</span>
            <span className="text-blue-400 font-mono">{settlementData?.deviation} 个</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-nether-muted">错误裁决</span>
            <span className="text-nether-red font-mono">{settlementData?.error} 个</span>
          </div>
          <div className="pt-4 flex justify-between items-center border-t border-nether-border/30">
            <span className="text-lg font-serif-sc">KPI 评分</span>
            <span className="text-2xl font-mono text-nether-accent">{settlementData?.kpi} <span className="text-xs text-nether-muted">/ {settlementData?.stage === '试用期' ? 6 : '---'}</span></span>
          </div>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <div className="flex items-center space-x-3">
            <span className="text-sm text-nether-muted">结论：</span>
            <span className={`text-xl font-bold tracking-widest ${settlementData?.passed ? 'text-nether-accent' : 'text-nether-red'}`}>
              {settlementData?.passed ? '达标 ✓' : '不达标 ✗'}
            </span>
          </div>
          
          <button 
            onClick={handleSettlementContinue}
            className="w-full py-4 bg-nether-accent text-nether-bg font-bold rounded-lg hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,150,0.2)]"
          >
            继续
          </button>
        </div>
      </div>

      {/* Promotion Overlay */}
      <AnimatePresence>
        {promotionData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-[110]"
          >
            <div className="max-w-sm w-full text-center space-y-8 p-10 bg-nether-bg border border-nether-accent/30 rounded-3xl shadow-[0_0_50px_rgba(0,255,150,0.1)]">
              <div className="w-20 h-20 bg-nether-accent/10 border border-nether-accent/30 rounded-full flex items-center justify-center mx-auto">
                <Trophy className="w-10 h-10 text-nether-accent" />
              </div>
              <div className="space-y-2">
                <div className="text-nether-accent text-sm tracking-widest uppercase">Promotion</div>
                <h3 className="text-2xl font-serif-sc">恭喜晋升为</h3>
                <div className="text-3xl font-bold text-nether-ink py-2">{promotionData.title}</div>
              </div>
              <p className="text-nether-muted text-sm leading-relaxed">
                {promotionData.nextStage}案件即将推送。
              </p>
              <button 
                onClick={startNextStage}
                className="w-full py-4 bg-nether-accent text-nether-bg font-bold rounded-xl hover:shadow-[0_0_30px_rgba(0,255,150,0.4)] transition-all"
              >
                开始
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  const EndingScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-nether-bg flex items-center justify-center p-6 z-[200] overflow-y-auto"
    >
      <div className="max-w-2xl w-full space-y-12 text-center py-12">
        {endingData?.type === '第一章·终' ? (
          <>
            <div className="space-y-4">
              <div className="text-nether-accent tracking-[1em] uppercase text-sm">Chapter One · End</div>
              <h1 className="text-4xl md:text-6xl font-serif-sc tracking-widest">第一章 · 终</h1>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 py-12 border-y border-nether-border">
              <div className="space-y-1">
                <div className="text-nether-muted text-xs uppercase tracking-widest">处理案件</div>
                <div className="text-4xl font-mono">{endingData.totalCases}</div>
              </div>
              <div className="space-y-1">
                <div className="text-nether-muted text-xs uppercase tracking-widest">正确裁决</div>
                <div className="text-4xl font-mono">{endingData.totalCorrect}</div>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <div className="text-nether-muted text-xs uppercase tracking-widest">最终职位</div>
                <div className="text-2xl md:text-3xl font-serif-sc text-nether-accent">首席判官</div>
              </div>
            </div>

            <div className="space-y-6 text-nether-ink/80 font-serif-sc text-xl leading-relaxed">
              <p>你发现的事情，比你想象的要大。</p>
              <p>幕后是谁，你还不知道。</p>
              <p className="text-nether-muted text-sm">后续章节开发中。</p>
            </div>

            <div className="pt-8 flex flex-col items-center space-y-4">
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded text-xs text-nether-muted">
                成就解锁：<span className="text-nether-accent">{endingData.achievement}</span>
              </div>
              <button 
                onClick={restartGame}
                className="px-12 py-4 bg-white text-nether-bg font-bold rounded hover:scale-105 transition-all"
              >
                回到主菜单
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="text-nether-red tracking-[0.5em] uppercase text-sm">Evaluation Failed</div>
              <h1 className="text-5xl font-serif-sc tracking-widest">阴曹通：评估完毕</h1>
            </div>

            <div className="space-y-8 py-12 text-lg leading-relaxed text-nether-ink/80 font-serif-sc">
              {endingData?.type === '转岗' ? (
                <>
                  <p>正确率不足。</p>
                  <p>建议转岗至——<span className="text-nether-accent">文件归档部门</span>。</p>
                </>
              ) : (
                <>
                  <p>阶段KPI未达标。</p>
                  <p>晋升申请已驳回。</p>
                  <p className="text-sm text-nether-muted">根据人事条例第37条——</p>
                  <p>您将被调离判官岗位。</p>
                  <p className="mt-8 text-nether-red italic">有些事，你永远不会知道了。</p>
                </>
              )}
            </div>

            <div className="pt-8 flex flex-col items-center space-y-6">
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded text-xs text-nether-muted">
                成就解锁：<span className="text-nether-accent">{endingData?.achievement}</span>
              </div>
              <button 
                onClick={restartGame}
                className="px-12 py-4 bg-nether-red text-white font-bold rounded hover:scale-105 transition-all shadow-[0_0_30px_rgba(255,50,50,0.2)]"
              >
                重新开始
              </button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );

  const AchievementListScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-nether-bg p-8 flex flex-col items-center"
    >
      <div className="max-w-4xl w-full flex flex-col">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-serif-sc tracking-widest text-nether-ink">成就列表</h2>
          <button 
            onClick={() => setScreen('START')}
            className="px-6 py-2 border border-nether-border text-nether-muted hover:text-nether-accent hover:border-nether-accent transition-all rounded"
          >
            返回
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pr-4 custom-scrollbar max-h-[600px] p-1">
          {ACHIEVEMENTS.map(ach => {
            const isUnlocked = gameState.achievements.includes(ach.id);
            return (
              <div 
                key={ach.id}
                className={`p-6 border rounded-xl transition-all flex flex-col space-y-3 ${
                  isUnlocked 
                    ? 'bg-nether-accent/5 border-nether-accent/30' 
                    : 'bg-black/40 border-nether-border/50 grayscale opacity-60'
                }`}
              >
                <div className="flex justify-between items-start">
                  <Trophy className={`w-6 h-6 ${isUnlocked ? 'text-nether-accent' : 'text-nether-muted'}`} />
                  {isUnlocked && <span className="text-[10px] bg-nether-accent/20 text-nether-accent px-2 py-0.5 rounded uppercase font-bold">已解锁</span>}
                </div>
                <div className="space-y-1">
                  <h3 className={`font-serif-sc text-lg ${isUnlocked ? 'text-nether-ink' : 'text-nether-muted'}`}>
                    {isUnlocked ? ach.name : '???'}
                  </h3>
                  <p className="text-xs text-nether-muted leading-relaxed">
                    {isUnlocked ? ach.description : '尚未解锁此成就'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );

  const GameScreen = (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen flex flex-col lg:h-screen lg:overflow-hidden"
    >
      {/* Top Status Bar */}
      <div className="h-auto lg:h-14 border-b border-nether-border bg-nether-btn/90 backdrop-blur-md px-4 lg:px-6 py-3 lg:py-0 flex flex-col lg:flex-row justify-between items-center shrink-0 z-20 space-y-3 lg:space-y-0">
        <div className="flex items-center space-x-4 lg:space-x-8">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-nether-accent/10 border border-nether-accent/30 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-nether-accent" />
            </div>
            <div className="text-xs lg:text-sm font-bold tracking-wider">Lv.{gameState.level} {gameState.stage}</div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] lg:text-xs text-nether-muted uppercase font-mono">KPI:</span>
            <span className="text-xs lg:text-sm font-mono text-nether-accent">{gameState.stageKPI}/6</span>
          </div>
        </div>
        <div className="flex items-center space-x-6 lg:space-x-4">
          <div className="text-[10px] lg:text-xs text-nether-muted font-mono tracking-widest">案件 #{gameState.currentCase?.id}</div>
          <button 
            onClick={() => setScreen('START')}
            className="text-[10px] lg:text-xs text-nether-muted hover:text-nether-accent transition-colors underline underline-offset-4"
          >
            退出系统
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
        {/* Left Column (70% on desktop) */}
        <div className="w-full lg:w-[70%] flex flex-col border-b lg:border-b-0 lg:border-r border-nether-border bg-black/10 p-4 lg:p-6 space-y-6 lg:overflow-y-auto">
          {/* Case File Card */}
          <div className="bg-nether-btn border border-nether-border rounded-lg p-4 lg:p-6 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity">
              <ScrollText className="w-16 lg:w-24 h-16 lg:h-24 -mr-2 lg:-mr-4 -mt-2 lg:-mt-4" />
            </div>
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-lg lg:text-xl font-bold text-nether-accent flex items-center space-x-2">
                <ScrollText className="w-5 h-5" />
                <span>案件档案</span>
              </h3>
              <div className="px-3 py-1 bg-nether-accent/10 border border-nether-accent/30 rounded text-[10px] text-nether-accent font-mono">
                {gameState.currentCase?.yct_grade}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 lg:gap-y-6 gap-x-4">
              <CaseField label="姓名" value={gameState.currentCase?.name} />
              <CaseField label="年龄" value={`${gameState.currentCase?.age}岁`} />
              <CaseField label="职业" value={gameState.currentCase?.occupation} />
              <CaseField label="死因" value={gameState.currentCase?.cause_of_death} className="text-nether-red/80" />
              <CaseField label="生死簿状态" value={gameState.currentCase?.registry_status} />
              <CaseField label="阴曹通评级" value={gameState.currentCase?.yct_grade} />
            </div>
          </div>

          {/* Soul Dialogue Area */}
          <div 
            ref={dialogueRef}
            className="h-[400px] lg:flex-1 flex flex-col space-y-4 bg-black/20 rounded-lg border border-nether-border p-4 lg:p-6 overflow-y-auto custom-scrollbar"
          >
            <div className="text-nether-muted text-[10px] uppercase tracking-widest mb-4">灵魂对话区</div>
            <div className="space-y-6">
              {gameState.dialogue.map((turn) => (
                <div key={turn.id} className={`flex ${turn.type === 'player' || turn.type === 'followup_option' ? 'justify-end' : 'justify-start'}`}>
                  {turn.type === 'system' || turn.type === 'yct' ? (
                    <div className={`w-full text-center py-2 border-y text-[10px] lg:text-xs font-mono ${
                      turn.type === 'yct' ? 'border-blue-400/20 text-blue-400/80' : 'border-nether-accent/20 text-nether-accent/80'
                    }`}>
                      {turn.text}
                    </div>
                  ) : (
                    <div className={`flex items-start space-x-3 lg:space-x-4 max-w-[90%] lg:max-w-[85%] ${turn.type === 'player' || turn.type === 'followup_option' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      <div className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full border flex items-center justify-center shrink-0 ${
                        turn.type === 'player' || turn.type === 'followup_option' ? 'bg-nether-accent/10 border-nether-accent/30' : 'bg-white/5 border-white/10'
                      }`}>
                        {turn.type === 'player' || turn.type === 'followup_option' ? (
                          <UserPlus className="w-4 h-4 lg:w-5 lg:h-5 text-nether-accent" />
                        ) : (
                          <Ghost className="w-4 h-4 lg:w-5 lg:h-5 text-nether-ink/40" />
                        )}
                      </div>
                      <div className={`p-3 lg:p-4 rounded-2xl relative ${
                        turn.type === 'player' || turn.type === 'followup_option'
                          ? 'bg-nether-accent/10 border border-nether-accent/30 rounded-tr-none' 
                          : 'bg-black/40 border border-nether-border rounded-tl-none'
                      }`}>
                        <div className={`absolute top-4 w-3 h-3 rotate-[-45deg] ${
                          turn.type === 'player' || turn.type === 'followup_option'
                            ? '-right-1.5 bg-nether-accent/10 border-r border-t border-nether-accent/30'
                            : '-left-1.5 bg-black/40 border-l border-t border-nether-border'
                        }`}></div>
                        <div className="font-serif-sc text-sm lg:text-base leading-relaxed text-nether-ink/90 whitespace-pre-wrap">
                          {turn.text}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Follow-up Options */}
              {gameState.toolsStatus.followupActive && !gameState.toolsStatus.followupUsed && (
                <div className="flex flex-col items-center space-y-3 pt-4">
                  {gameState.currentCase?.followup.map((f, i) => {
                    const isUsed = gameState.toolsStatus.usedFollowupIndices.includes(i);
                    return (
                      <button
                        key={i}
                        disabled={isUsed}
                        onClick={() => handleFollowupSelect(i)}
                        className={`px-4 lg:px-6 py-2 rounded-full border transition-all text-xs lg:text-sm font-serif-sc text-center ${
                          isUsed
                            ? 'opacity-30 border-nether-border text-nether-muted cursor-not-allowed'
                            : 'border-nether-accent text-nether-accent hover:bg-nether-accent/10'
                        }`}
                      >
                        [追问：{f.question}]
                      </button>
                    );
                  })}
                </div>
              )}

              {/* AI Thinking Indicator */}
              {isAiThinking && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-3 lg:space-x-4 max-w-[85%]">
                    <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full border bg-white/5 border-white/10 flex items-center justify-center shrink-0">
                      <Ghost className="w-4 h-4 lg:w-5 lg:h-5 text-nether-ink/40 animate-pulse" />
                    </div>
                    <div className="p-3 lg:p-4 rounded-2xl bg-black/40 border border-nether-border rounded-tl-none relative">
                      <div className="absolute top-4 w-3 h-3 rotate-[-45deg] -left-1.5 bg-black/40 border-l border-t border-nether-border"></div>
                      <div className="font-serif-sc text-xs lg:text-sm text-nether-muted animate-pulse">
                        思考中...
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inquiry Buttons Area */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
              {gameState.currentCase?.questions.map((q, idx) => (
                <InquiryButton 
                  key={q.id}
                  isUsed={gameState.toolsStatus.usedInquiryIds.includes(q.id)}
                  disabled={isAiThinking}
                  label={`${String.fromCharCode(65 + idx)}.「${q.text}」`} 
                  onClick={() => handleInquiry(q.id, q.text)}
                />
              ))}
            </div>
            <div className="relative">
              <form onSubmit={handleFreeInquiry}>
                <input 
                  value={freeQuestion}
                  onChange={(e) => setFreeQuestion(e.target.value)}
                  disabled={isAiThinking}
                  type="text" 
                  placeholder={isAiThinking ? "灵魂正在思考..." : "自由提问（输入并回车）"} 
                  className="w-full bg-black/20 border border-nether-border rounded-lg px-4 py-3 text-nether-ink focus:border-nether-accent outline-none font-mono text-xs lg:text-sm transition-all"
                />
              </form>
            </div>
          </div>

          {/* Judgement Area */}
          <div className="pt-4 border-t border-nether-border">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs lg:text-sm font-bold text-nether-muted uppercase tracking-widest">最终裁决</h4>
              <span className="text-[9px] lg:text-[10px] text-nether-muted/50 font-mono italic">需完成所有询问后解锁</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
              <JudgementButton 
                label="投胎" 
                color="white" 
                disabled={gameState.toolsStatus.usedInquiryIds.length < (gameState.currentCase?.questions.length || 0) || gameState.toolsStatus.verdictCompleted} 
                onClick={() => handleVerdict("投胎")}
              />
              <JudgementButton 
                label="打入地狱" 
                color="red" 
                disabled={gameState.toolsStatus.usedInquiryIds.length < (gameState.currentCase?.questions.length || 0) || gameState.toolsStatus.verdictCompleted} 
                onClick={() => handleVerdict("打入地狱")}
              />
              <JudgementButton 
                label="功德超度" 
                color="green" 
                disabled={gameState.toolsStatus.usedInquiryIds.length < (gameState.currentCase?.questions.length || 0) || gameState.toolsStatus.verdictCompleted} 
                onClick={() => handleVerdict("功德超度")}
              />
              <JudgementButton 
                label="申请复议" 
                color="yellow" 
                disabled={gameState.toolsStatus.usedInquiryIds.length < (gameState.currentCase?.questions.length || 0) || gameState.toolsStatus.verdictCompleted} 
                onClick={() => handleVerdict("申请复议")}
              />
            </div>
            
            {gameState.toolsStatus.verdictCompleted && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center space-y-4 pt-6 border-t border-nether-border"
              >
                <div className="text-nether-accent font-bold tracking-[0.3em] animate-pulse text-sm">案件已结案</div>
                <button 
                  onClick={handleNextCase}
                  className="px-8 py-3 bg-nether-accent text-nether-bg font-bold rounded hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,150,0.3)]"
                >
                  下一案件
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right Column (30% on desktop) */}
        <div className="w-full lg:w-[30%] flex flex-col bg-black/20">
          {/* Yin-Chat Message Stream (60% height on desktop) */}
          <div className="h-[300px] lg:h-[60%] flex flex-col border-b border-nether-border">
            <div className="p-4 border-b border-nether-border bg-black/20 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-nether-accent" />
              <span className="text-xs font-bold text-nether-accent tracking-widest uppercase">阴曹通 · 实时流</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {gameState.messages.map((msg: Message) => (
                <YinChatMessage key={msg.id} type={msg.type} text={msg.text} />
              ))}
            </div>
          </div>

          {/* Investigation Tools Area */}
          <div className="flex-1 p-4 lg:p-6 flex flex-col space-y-3 lg:overflow-y-auto">
            <h4 className="text-[10px] font-bold text-nether-muted uppercase tracking-[0.2em] mb-2">调查工具</h4>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:gap-3">
              <ToolButton 
                icon="👁" 
                label={gameState.toolsStatus.spiritSenseUsed ? "已完成" : "灵力感知"} 
                color="blue" 
                onClick={handleSpiritSense}
                disabled={gameState.toolsStatus.spiritSenseUsed || !gameState.toolsStatus.inquiryUsed}
                tooltip={!gameState.toolsStatus.inquiryUsed ? "需要先完成全部询问" : undefined}
              />
              <ToolButton 
                icon="📋" 
                label={gameState.toolsStatus.followupUsed ? "已完成" : "追问"} 
                color="yellow" 
                onClick={handleFollowup}
                disabled={!gameState.toolsStatus.spiritSenseUsed || gameState.toolsStatus.followupActive}
                tooltip={
                  !gameState.toolsStatus.spiritSenseUsed 
                    ? "需要先完成灵力感知" 
                    : gameState.toolsStatus.followupActive && !gameState.toolsStatus.followupUsed
                      ? "请在对话区选择追问内容"
                      : undefined
                }
              />
              <ToolButton 
                icon="⚖️" 
                label={gameState.toolsStatus.compareCluesFound ? "已发现矛盾" : "对比线索"} 
                color="green" 
                onClick={handleCompareClues}
                disabled={!gameState.toolsStatus.compareCluesUnlocked}
                tooltip={!gameState.toolsStatus.compareCluesUnlocked ? "需要先完成追问" : undefined}
              />
              <ToolButton 
                icon="📁" 
                label="查阅档案" 
                color="purple" 
                onClick={handleArchive}
                disabled={!gameState.toolsStatus.spiritSenseUsed}
                tooltip={!gameState.toolsStatus.spiritSenseUsed ? "需要先完成灵力感知" : undefined}
              />
              <ToolButton 
                icon="📖" 
                label="手册" 
                color="gray" 
                onClick={handleNotebook}
                className="col-span-2 lg:col-span-1"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => modal.onClose ? modal.onClose() : setModal(null)}
              className="absolute inset-0 bg-black/50 backdrop-blur-[6px]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-2xl bg-nether-btn border border-nether-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-nether-border flex justify-between items-center bg-black/20">
                <h3 className="text-xl font-bold text-nether-accent tracking-widest">{modal.title}</h3>
                <button 
                  onClick={() => modal.onClose ? modal.onClose() : setModal(null)}
                  className="text-nether-muted hover:text-nether-ink transition-colors"
                >
                  <UserPlus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto custom-scrollbar">
                {modal.title === "对比线索" && !gameState.toolsStatus.compareCluesFound ? (
                  <CompareModalContent 
                    gameState={gameState}
                    slotA={slotA}
                    slotB={slotB}
                    setSlotA={setSlotA}
                    setSlotB={setSlotB}
                    setModal={setModal}
                    setGameState={setGameState}
                  />
                ) : modal.content}
              </div>
              <div className="p-4 border-t border-nether-border bg-black/10 flex justify-end">
                <button 
                  onClick={() => modal.onClose ? modal.onClose() : setModal(null)}
                  className="px-6 py-2 border border-nether-border rounded text-sm text-nether-muted hover:text-nether-ink hover:border-nether-accent transition-all"
                >
                  {gameState.toolsStatus.compareCluesFound && modal.title === "对比线索" ? "确认" : "关闭"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-nether-bg text-nether-ink selection:bg-nether-accent selection:text-nether-bg">
      <AnimatePresence>
        {activeAchievement && <AchievementBanner achievement={activeAchievement} />}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {screen === 'START' && StartScreen}
        {screen === 'CREATE' && CreateScreen}
        {screen === 'OPENING' && OpeningScreen}
        {screen === 'WELCOME' && WelcomeScreen}
        {screen === 'GAME' && GameScreen}
        {screen === 'SETTLEMENT' && SettlementScreen}
        {screen === 'ENDING' && EndingScreen}
        {screen === 'ACHIEVEMENTS' && AchievementListScreen}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-nether-red/10 border border-nether-red/30 text-nether-red px-6 py-2 rounded-full backdrop-blur-md z-50 text-sm font-bold"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AchievementBanner({ achievement }: { achievement: Achievement }) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 20, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-nether-accent border border-white/20 px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3"
    >
      <Trophy className="w-5 h-5 text-white" />
      <div>
        <div className="text-[10px] text-white/70 uppercase tracking-widest font-bold">成就解锁</div>
        <div className="text-white font-serif-sc">{achievement.name}</div>
      </div>
    </motion.div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: ReactNode, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="group flex items-center space-x-4 bg-nether-btn border border-nether-border px-6 py-4 rounded-lg hover:border-nether-accent transition-all active:scale-95"
    >
      <div className="text-nether-muted group-hover:text-nether-accent transition-colors">
        {icon}
      </div>
      <span className="text-lg font-medium tracking-widest text-nether-ink group-hover:text-nether-accent transition-colors">
        {label}
      </span>
    </button>
  );
}

function CaseField({ label, value, className = "" }: { label: string, value?: string | number, className?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] text-nether-muted uppercase tracking-wider font-mono">{label}</div>
      <div className={`text-sm font-medium ${className}`}>{value || "---"}</div>
    </div>
  );
}

function InquiryButton({ label, onClick, disabled, isUsed }: { label: string, onClick?: () => void | Promise<void>, disabled?: boolean, isUsed?: boolean, key?: any }) {
  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={`text-left border p-3 rounded transition-all text-sm group relative flex items-center space-x-2 ${
        isUsed 
          ? 'bg-nether-accent/5 border-nether-accent/30 text-nether-ink/90' 
          : 'bg-nether-btn border-nether-border text-nether-ink/80 hover:border-nether-accent hover:bg-nether-accent/5'
      } ${disabled ? 'cursor-wait opacity-80' : ''}`}
    >
      {isUsed ? (
        <CheckCircle2 className="w-3 h-3 text-nether-accent shrink-0" />
      ) : (
        <div className="w-3 h-3 shrink-0" />
      )}
      <span className="group-hover:text-nether-accent transition-colors flex-1">{label}</span>
    </button>
  );
}

function JudgementButton({ label, color, disabled, onClick }: { label: string, color: 'white' | 'red' | 'green' | 'yellow', disabled?: boolean, onClick?: () => void }) {
  const colors = {
    white: "border-white/20 text-white/40 hover:border-white/60 hover:text-white",
    red: "border-nether-red/20 text-nether-red/40 hover:border-nether-red/60 hover:text-nether-red",
    green: "border-nether-accent/20 text-nether-accent/40 hover:border-nether-accent/60 hover:text-nether-accent",
    yellow: "border-yellow-600/20 text-yellow-600/40 hover:border-yellow-600/60 hover:text-yellow-600"
  };

  return (
    <button 
      disabled={disabled}
      onClick={onClick}
      className={`py-3 rounded border flex flex-col items-center justify-center space-y-1 transition-all ${disabled ? 'cursor-not-allowed opacity-50 grayscale' : 'hover:scale-105'} ${colors[color]}`}
    >
      <div className={`w-2 h-2 rounded-full ${color === 'white' ? 'bg-white' : color === 'red' ? 'bg-nether-red' : color === 'green' ? 'bg-nether-accent' : 'bg-yellow-600'}`}></div>
      <span className="text-xs font-bold tracking-tighter">{label}</span>
    </button>
  );
}

function YinChatMessage({ type, text }: { type: 'info' | 'warning' | 'system', text: string, key?: string | number }) {
  const styles: Record<string, string> = {
    info: "bg-blue-900/20 border-blue-800/40 text-blue-300",
    warning: "bg-yellow-900/20 border-yellow-800/40 text-yellow-300",
    system: "bg-emerald-900/20 border-emerald-800/40 text-emerald-400"
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-3 rounded-lg border text-xs leading-relaxed ${styles[type]}`}
    >
      {text}
    </motion.div>
  );
}

function ToolButton({ icon, label, color, onClick, disabled, tooltip }: { icon: string, label: string, color: 'blue' | 'yellow' | 'green' | 'purple' | 'gray', onClick?: () => void, disabled?: boolean, tooltip?: string }) {
  const colors = {
    blue: "text-blue-400 border-blue-400/20 bg-blue-400/5 hover:border-blue-400/40",
    yellow: "text-yellow-400 border-yellow-400/20 bg-yellow-400/5 hover:border-yellow-400/40",
    green: "text-nether-accent border-nether-accent/20 bg-nether-accent/5 hover:border-nether-accent/40",
    purple: "text-purple-400 border-purple-400/20 bg-purple-400/5 hover:border-purple-400/40",
    gray: "text-nether-muted border-nether-border bg-white/5 hover:border-nether-accent/40"
  };

  const disabledStyles = "opacity-30 grayscale cursor-not-allowed border-nether-border bg-transparent text-nether-muted";

  return (
    <div className="relative group/tool">
      <button 
        disabled={disabled}
        onClick={onClick}
        className={`w-full flex items-center space-x-3 p-3 rounded border transition-all ${disabled ? disabledStyles : colors[color] + ' hover:scale-[1.02] active:scale-[0.98]'}`}
      >
        <span className="text-lg">{icon}</span>
        <span className="text-xs font-bold tracking-widest">{label}</span>
      </button>
      {disabled && tooltip && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1 bg-black/90 border border-nether-border text-[10px] text-nether-ink whitespace-nowrap rounded opacity-0 group-hover/tool:opacity-100 transition-opacity pointer-events-none z-50">
          {tooltip}
        </div>
      )}
    </div>
  );
}
