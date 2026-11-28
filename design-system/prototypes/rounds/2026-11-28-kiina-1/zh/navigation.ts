// zh-CN for web/src/text/navigation.ts (agent draft, not reviewed; the keys
// the rail reads in this round).
export default {
  navigationText: {
    ageHours: (n: number) => `${n} 小时`,
    agoHours: (n: number) => `${n} 小时前`,
    closeNavigation: '关闭导航',
    conversationActions: '对话操作',
    details: '详情',
    filterWorkspaces: '筛选工作区',
    home: '首页',
    keyboardHint: (move: string, turn: string) => `${move}：上一个/下一个可见对话。${turn}：等待你的对话。`,
    newWorkspace: '新建工作区',
    openNavigation: '打开导航',
    openWorkspace: '打开工作区',
    places: '位置',
    railLabel: '工作区和对话',
    running: '运行中',
    skip: '跳到内容',
    workspaces: '工作区',
    yourTurn: '轮到你',
  },
};
