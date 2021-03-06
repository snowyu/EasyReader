//@flow
import React from 'react';
import {
  View,
  Text,
  Dimensions,
  ListView,
  TouchableWithoutFeedback,
  PanResponder,
  RefreshControl,
  findNodeHandle,
} from 'react-native';
import { Actions } from 'react-native-router-flux';
import {
  Container,
  Navbar
} from 'navbar-native';
import { parseArticleContent } from '../parser';
import { Button } from 'react-native-elements'
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import { UIManager } from 'NativeModules';

import { updateLastRead } from '../ducks/directory';
import parseContent from '../utils/parseContent';
//在切换页面的时候,发送通知,切换index
type Props = {
  novel: Novel,
  navigationState: any,
  directory: Array<Article>,
  index: number, // start
};

const ds = new ListView.DataSource({ rowHasChanged: (r1, r2) => r1 !== r2 });
class Reader extends React.Component {
  realm: Realm;
  props: Props;
  state: {
    index: number,//current
    refetch: number,
    navMargin: number,
    fetching: bool,
    dataSource: ListView.DataSource | null,
    fontSize: number,
    maxContentLength: number,
    backgroundColor: string,
    color: string,
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      index: parseInt(props.index),
      refetch: 0,
      navMargin: 0,
      fetching: true,
      dataSource: null,
      fontSize: 12,
      maxContentLength: 0,
      backgroundColor: '#9FB2A1',
      color: 'black',
    };
    this.realm = realmFactory();
  }

  fetchContent = (index: number, refresh: bool = false) => {
    let article: Article = this.props.directory.get(index);
    if (!article) {
      return;
    }
    this._isMounted && this.setState({
      navMargin: 0,
      fetching: true,
      maxContentLength: 0,
      index
    });

    this.realm.write(() => {
      this.props.novel.lastReadIndex = index;
      this.props.novel.lastReadTitle = article.get('title');
    });


    parseArticleContent(this.props.novel.directoryUrl, article.get('url'), refresh).then((content: string) => {
      var {height, width} = Dimensions.get('window');
      lineWidth = Math.floor((width - this.state.fontSize) * 2 / this.state.fontSize);
      let rows = parseContent(content, lineWidth);
      let btnArr = [];

      if (this.props.directory.get(index - 1)) {
        btnArr.push(
          <Button key="before-article"
            onPress={e => this.handleGotoArticle(index - 1)}
            title='上一章' />
        );
      }
        btnArr.push(
          <Button key="back"
            onPress={Actions.pop}
            title='返回' />
        );

      if (this.props.directory.get(index + 1)) {
        btnArr.push(
          <Button key="after-article"
            onPress={e => this.handleGotoArticle(index + 1)}
            title='下一章' />
        );
      }

      let btns = (<View style={{
        flex: 1,
        flexDirection: "row",
        justifyContent: 'space-between',
        height: 40
      }}>
        {btnArr}
      </View>)
      rows.push(btns);

      let title = (
        <Text style={{
          fontSize: this.state.fontSize + 10,
          lineHeight: this.state.fontSize + 15,
          fontWeight: '300'
        }}>{article.get('title') + "\n"}</Text>
      );
      rows.unshift(title);
      rows.unshift(btns);

      this._isMounted && this.setState({
        fetching: false,
        dataSource: ds.cloneWithRows(rows),
        index
      });
    }).done(() => {
      //load more data
      for (var i = 1; i <= 5; i++) {
        if (this.props.directory.get(index + i)) {
          parseArticleContent(this.props.novel.directoryUrl, this.props.directory.getIn([index + i, 'url'])).catch(e => {
            console.log(e);
          });
        }
      }
    });


  }

  componentDidMount() {
    this.fetchContent(this.state.index);
  }

  handleGotoArticle = (index: number) => {
    this.props.updateLastRead(index);
    this.fetchContent(index);;
  }
  lastContentOffsetY = 0;
  handleScroll = (e: Event) => {
    if (e.nativeEvent.contentOffset.y > 100) {
      this.setState({
        navMargin: -64
      });

    }
    else {
      this.setState({
        navMargin: 0
      });

    }

    // if (e.nativeEvent.contentOffset.y > 100) {
    //   if (this.state.maxContentLength > 0

    //     &&
    //     (e.nativeEvent.contentOffset.y > this.state.maxContentLength
    //       || this.state.maxContentLength - e.nativeEvent.contentOffset.y < 200
    //     )
    //   ) {
    //   } else {
    //     let difference = e.nativeEvent.contentOffset.y - this.lastContentOffsetY;
    //     if (difference > 0) {
    //       if (this.state.navMargin > -64) {
    //         let val = this.state.navMargin - difference < -64 ? -64 : this.state.navMargin - difference;
    //         this.setState({
    //           navMargin: val
    //         });
    //       }
    //     } else {
    //       if (this.state.navMargin != 0) {
    //         let val = this.state.navMargin - difference > 0 ? 0 : this.state.navMargin - difference;
    //         this.setState({
    //           navMargin: val
    //         });
    //       }
    //     }
    //   }
    // }

    this.lastContentOffsetY = e.nativeEvent.contentOffset.y;
    console.log('lastContentOffsetY:', this.lastContentOffsetY);
  }

  handleContentClick = (e)=>{

    if(this.state.showSetting){
      this.setState({
        showSetting:false
      });
      return ;
    }
    var {pageX,pageY} = e.nativeEvent;
    var {height, width} = Dimensions.get('window');
    // this.refs.content.measure((fx, fy, width, height, px, py) =>{})
    // var handle = findNodeHandle(this.refs.content);
    // UIManager.measure(handle, (x, y, width, height, pageX, pageY) => {
    //   console.log('height', height)
    // })
    let offset = this.lastContentOffsetY;

    if(pageY>height/3 && pageY<height*2/3
    && pageX>width/3 && pageX<width*2/3
    ){
      //show/hide navbar
      this.setState({
        showSetting:true
      });
      return ;
    }else if(pageY<height/2){
      var t = offset-height
      if (t < 0) t = 0;
      this.refs.content.scrollTo({y:t, animated:false})
      // console.log('scrollTo',t)
    }else{
      // console.log('pageY>=height/2')
      this.refs.content.scrollTo({y:height+offset, animated:false})
      // console.log('scrollTo',height+offset)
    }
  }
  toggleNight = () =>{
    if (this.night == null)
      this.night = 0
    else
      this.night++;
    if (this.night === 2) this.night = null
    console.log('toggleNight', this.night)
    let vState = {}
    if (this.night === 1) {
      //is night
      vState.backgroundColor = 'black';
      vState.color = 'gray';
    } else if (this.night === 0) {
      vState.backgroundColor = '#9FB2A1';
      vState.color = 'black';
    } else {
      const vHours = (new Date()).getHours()
      if ((vHours >= 19 && vHours <= 24) || (vHours >= 0 && vHours <= 9)) {
        //is night
        vState.backgroundColor = 'black';
        vState.color = 'gray';
      } else {
        vState.backgroundColor = '#9FB2A1';
        vState.color = 'black';
      }
    }
    this._isMounted && this.setState(vState);
  }

  render() {
    let current = this.props.directory.get(this.state.index);
    if (current) {
      // let leftBtns = [{
      //   icon: "ios-arrow-back",
      //   label: "返回",
      //   onPress: Actions.pop
      // }];
      let leftBtns = [];


      let rightBtns = [{
        icon: "md-refresh",
        onPress: e => {
          this.fetchContent(this.state.index, true);
        }
      }];
      let nightBtn = {
        icon: "ios-moon",
        onPress: e => {
          this.toggleNight();
        }
      }
      if (this.night === 0) {
        nightBtn.icon = "ios-sunny";
      } else if (this.night == null) {
        nightBtn.icon = "ios-partly-sunny";
      }
      leftBtns.unshift(nightBtn);

      if (this.night == null) {
        const vHours = (new Date()).getHours()
        if ((vHours >= 19 && vHours <= 24) || (vHours >= 0 && vHours <= 9)) {
          //is night
          this.state.backgroundColor = 'black';
          this.state.color = 'gray';
        } else {
          this.state.backgroundColor = '#9FB2A1';
          this.state.color = 'black';
        }
      }

      let containerParams = {
        type:"plain",
        style:{
            backgroundColor: this.state.backgroundColor,
        }
      };
      let content;
      if (this.state.fetching) {
        containerParams.loading={
          styleContainer:{
            // marginTop:Platform.OS == 'ios'?64:40,
            backgroundColor:'rgba(102,102,102,.5)'
          },
          coverNavbar:false
        }
      } else {
        var {height, width} = Dimensions.get('window');
        let style = {
          fontSize: this.state.fontSize,
          height: Math.ceil(this.state.fontSize * 1.35),
          lineHeight: Math.ceil(this.state.fontSize * 1.35),
          fontWeight: '300',
          width:width+100,
          color: this.state.color,
        };
        //将内容分成多个数组来显示
        content = <ListView ref='content'
          style={{
            height: height,
            paddingTop: 10,
            paddingLeft: this.state.fontSize - 10,
          }}
          renderFooter={() => {
            return <View style={{
              height: 100
            }} />
          } }
          onScroll={this.handleScroll.bind(this)}
          initialListSize={40}
          pageSize={40}
          onEndReachedThreshold={100}
          scrollRenderAheadDistance={500}
          dataSource={this.state.dataSource}
          renderRow={(rowData) => {
            if (typeof (rowData) == "string") {
              return <TouchableWithoutFeedback onPress={this.handleContentClick}><Text style={style}>{rowData}</Text></TouchableWithoutFeedback>;
            } else {
              return rowData;
            }
          } }
          />
      }

      if (this.props.needShowDir) {
        rightBtns.unshift({
          icon: "md-list",
          onPress: ()=>Actions.directory({novel:this.props.novel})
        });
      }
      return (
        <Container
        {...containerParams}
          >
          <Navbar
            title={current.get('title')}
            left={leftBtns}
            right={rightBtns}
            style={{
              marginTop: this.state.navMargin
            }}
            />
          {content}
        </Container>
      );
    } else {
      return (
        <Container>
          <Navbar
            title="没有下一章了"
            left={{
              icon: "ios-arrow-back",
              label: "返回",
              onPress: Actions.pop
            }}
            />
          <Text>没有更多内容了</Text>
        </Container>
      );
    }
  }

  _isMounted = true;
  componentWillUnmount() {
    this._isMounted = false;
  }

}
const mapStateToProps = (state, ownProps) => {
  return {
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updateLastRead: bindActionCreators(updateLastRead, dispatch),
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(Reader);
