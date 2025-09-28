import VueAlphaPlayer from "./vue-alpha-player.vue";

// 组件安装函数
const install = (app) => {
  app.component("VueAlphaPlayer", VueAlphaPlayer);
};

// 支持 Vue.use() 全局安装
VueAlphaPlayer.install = install;

export default VueAlphaPlayer;
