/**
 * 电子宠物模块
 * 宠物有心情值、成长值、等级系统
 * 完成任务获得食物喂养宠物
 */

const PetSystem = (() => {
  // 宠物表情映射
  const faces = {
    happy: ['😊', '😄', '🥰', '😆'],
    neutral: ['😐', '🙂', '😑'],
    sad: ['😢', '😔', '🥺'],
    excited: ['🤩', '🥳', '🎉'],
    sleepy: ['😴', '🥱']
  };

  // 宠物说的话（按心情分组）
  const speeches = {
    happy: [
      '今天状态不错哦~',
      '你越来越棒了！',
      '继续加油，我在看着呢~',
      '完成任务的感觉真好！',
      '你就是最棒的！'
    ],
    neutral: [
      '今天也要加油哦~',
      '有什么需要帮忙的吗？',
      '一步一步来就好~',
      '我相信你可以的！'
    ],
    sad: [
      '好久没来看我了...',
      '我有点想你了...',
      '要不要一起做点什么？',
      '没关系，慢慢来就好~'
    ],
    excited: [
      '太厉害了！！！',
      '你简直是超人！',
      '我要给你颁个奖！',
      '今天状态爆棚啊！'
    ],
    encourage: [
      '先做5分钟就好，我在旁边陪你~',
      '别怕，慢慢来，你比想象中厉害！',
      '每一步都算数，加油！',
      '我相信你能做到！',
      '完成这一步就很棒了~'
    ],
    idle: [
      '在等你回来哦~',
      '休息好了就继续吧~',
      '要不要看看还有什么任务？',
      '我在这里陪你~'
    ]
  };

  // 等级配置
  const levels = [
    { level: 1, name: '小萌新', growthNeeded: 100, emoji: '🐣' },
    { level: 2, name: '行动派', growthNeeded: 250, emoji: '🐥' },
    { level: 3, name: '效率达人', growthNeeded: 500, emoji: '🦅' },
    { level: 4, name: '自律王者', growthNeeded: 1000, emoji: '🦁' },
    { level: 5, name: '传奇人物', growthNeeded: 2000, emoji: '🌟' }
  ];

  /**
   * 获取宠物当前表情
   */
  function getFace(mood) {
    if (mood >= 80) return randomOf(faces.excited);
    if (mood >= 60) return randomOf(faces.happy);
    if (mood >= 40) return randomOf(faces.neutral);
    if (mood >= 20) return randomOf(faces.sad);
    return randomOf(faces.sleepy);
  }

  /**
   * 获取宠物说话内容
   */
  function getSpeech(mood, context = 'normal') {
    if (context === 'encourage') return randomOf(speeches.encourage);
    if (context === 'idle') return randomOf(speeches.idle);
    if (mood >= 80) return randomOf(speeches.excited);
    if (mood >= 60) return randomOf(speeches.happy);
    if (mood >= 40) return randomOf(speeches.neutral);
    return randomOf(speeches.sad);
  }

  /**
   * 计算等级
   */
  function getLevel(growth) {
    let current = levels[0];
    for (const lv of levels) {
      if (growth >= lv.growthNeeded) {
        current = lv;
      } else {
        break;
      }
    }
    return current;
  }

  /**
   * 获取下一级信息
   */
  function getNextLevel(growth) {
    const current = getLevel(growth);
    const idx = levels.findIndex(l => l.level === current.level);
    if (idx < levels.length - 1) {
      return levels[idx + 1];
    }
    return null; // 已满级
  }

  /**
   * 计算成长进度百分比
   */
  function getGrowthProgress(growth) {
    const current = getLevel(growth);
    const next = getNextLevel(growth);
    if (!next) return 100;
    const baseLine = current.growthNeeded;
    const range = next.growthNeeded - baseLine;
    return Math.min(100, Math.round(((growth - baseLine) / range) * 100));
  }

  /**
   * 喂养宠物（完成任务时调用）
   * @returns {{ growthGained: number, levelUp: boolean, newLevel: object|null }}
   */
  function feed(pet, taskDifficulty = 'easy') {
    const growthMap = { easy: 15, medium: 25, hard: 40 };
    const growthGained = growthMap[taskDifficulty] || 15;
    const moodGained = 10;

    const oldLevel = getLevel(pet.growth);
    pet.growth = Math.min(9999, pet.growth + growthGained);
    pet.mood = Math.min(100, pet.mood + moodGained);
    pet.lastFed = new Date().toISOString().split('T')[0];

    const newLevel = getLevel(pet.growth);
    const levelUp = newLevel.level > oldLevel.level;

    return { growthGained, moodGained, levelUp, newLevel: levelUp ? newLevel : null };
  }

  /**
   * 心情随时间衰减（每天调用一次）
   */
  function decayMood(pet) {
    const today = new Date().toISOString().split('T')[0];
    if (pet.lastFed === today) return; // 今天喂过，不衰减

    const daysSinceFed = Math.floor((Date.now() - new Date(pet.lastFed).getTime()) / 86400000);
    if (daysSinceFed >= 1) {
      pet.mood = Math.max(0, pet.mood - Math.min(20, daysSinceFed * 5));
    }
  }

  function randomOf(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  return { getFace, getSpeech, getLevel, getNextLevel, getGrowthProgress, feed, decayMood, levels };
})();
