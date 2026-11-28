// zh-CN names of the settings sections (agent draft, not reviewed), and of
// the rows of the sections this round opens. Production keeps English in
// web/src/text/settingsIndex.ts as a typed object beside the Finnish in
// app/settingsIndex.ts and switches on `language !== "fi"`; build.mjs adds a
// zh-CN branch that overlays these on the English sections.
export const settingsIndexZh: Record<string, {label: string; intro?: string; rows?: Record<string, {label: string; desc?: string}>}> = {
  tili: {label: '账号', rows: {
    account: {label: '个人资料和退出登录', desc: '来自 GitHub 的姓名和头像。在此浏览器上退出登录。'},
    'git-identity': {label: 'Git 身份', desc: '提交的作者。保存在全局 ~/.gitconfig 文件中。'},
    instructions: {label: '智能体说明', desc: '智能体在每次对话开始时阅读的说明。Pi 和 Claude 读取同一个文件。'},
  }},
  laitteet: {label: '设备'},
  avaimet: {label: '密钥'},
  tekoaly: {label: 'AI'},
  tilannekatsaus: {label: '进展摘要'},
  sanelu: {label: '语音输入'},
  koodipalvelut: {label: '代码托管'},
  tiedot: {label: '智能体可用的数据'},
  omatkoneet: {label: '自己的电脑'},
  ulkoasu: {label: '外观', rows: {
    theme: {label: '主题', desc: '“跟随系统”使用设备的设置。仅适用于此浏览器。'},
    language: {label: '语言', desc: '界面语言。适用于你的所有设备。'},
  }},
  aanet: {label: '声音'},
  editori: {label: '编辑器'},
  tila: {label: '存储空间'},
  kokeelliset: {label: '实验性功能'},
  palvelin: {label: '服务器'},
  palvelinintegraatiot: {label: '服务器集成'},
  aiavain: {label: 'AI 密钥'},
  saneluavain: {label: '语音输入密钥'},
  kayttoonotto: {label: '新用户引导'},
  kayttajat: {label: '用户和访问权限'},
  keskustelut: {label: '对话'},
  levy: {label: '磁盘空间'},
};
