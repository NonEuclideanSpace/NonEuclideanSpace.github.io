![[Screenshot 2026-10-24 at 09.30.54.png]]
按层编号的完全二叉树，编号之间关系固定：
$$\text{左孩子}=2i,\quad \text{右孩子}=2i+1,\quad \text{父亲}=\lfloor i/2\rfloor$$
一直/2== 从结点向根走
我的做法：
```cpp
#include <bits/stdc++.h>
using namespace std;
int main(){
    int x,y;cin>>x>>y;
    deque<int>a,b;
    while(x>1){
        a.push_front(x);
        x/=2;
    }
    a.push_front(1);
    while(y>1){
        b.push_front(y);
        y/=2;
    }
    b.push_front(1);
    bool flag=false;
    for(int i=0;i<min(a.size(),b.size());i++){
        if(a[i]==b[i]){
            continue;
        }else{
            cout<<a[i-1]<<endl;
            flag=true;
            break;
        }
    }
    if(flag==false){
        cout<<a[min(a.size(),b.size())-1];
    }
}
```
**踩过的坑**：较短的路径整条都是较长路径的前缀时（x 是 y 的祖先、反过来、或者 x == y），比较循环会一直 `continue` 到结束，什么都不输出。修正办法是在循环结束后补一个分支：这种情况下答案就是较短路径的最后一个元素。补上之后，开头特判 `x==1||y==1` 也就不需要了，它只是这类情况里的一个特例。
更短的写法：编号大的结点一定不会在编号小的结点上面，所以每次让较大的那个往上走一步，直到两者相等
```cpp
while(x!=y){
	if(x>y)x/=2;
	else y/=2;
}
```
![[Screenshot 2026-10-24 at 09.36.32.png]]
我的做法：
```cpp
#include <bits/stdc++.h>
using namespace std;
struct Node{
    char val;
    Node* left;
    Node* right;
};
vector<Node*>tree;
string s;
int cnt=1;
void build(Node* node){
    if(s[cnt]=='.'){
        cnt++;
    }else{
        node->left=new Node{s[cnt],nullptr,nullptr};
        tree.push_back(node->left);
        cnt++;         
        build(node->left);
    }
    if(s[cnt]=='.'){
        cnt++;
    }else{
        node->right=new Node{s[cnt],nullptr,nullptr};
        tree.push_back(node->right);
        cnt++;
        build(node->right);
    }
}
void midtraverse(Node *node){
    if(node==nullptr)return;
    midtraverse(node->left);
    cout<<node->val;
    midtraverse(node->right);
}
void posttraverse(Node *node){
    if(node==nullptr)return;
    posttraverse(node->left);
    posttraverse(node->right);
    cout<<node->val;
}
int main(){
    cin>>s;
    if(s[0]=='.')return 0;
    Node* root=new Node{s[0],nullptr,nullptr};
    tree.push_back(root);
    build(root);
    midtraverse(root);cout<<endl;
    posttraverse(root);cout<<endl;
    return 0;
}
```

思路：用一个全局下标cnt记录读到哪里，按先序顺序递归


![[Screenshot 2026-10-24 at 09.59.26.png]]


![[Screenshot 2026-10-24 at 09.59.45.png]]





![[Screenshot 2026-10-24 at 10.00.51.png]]
样例输入

2
5 5
0 1 2
1 -1 -1
2 3 4
3 -1 -1
4 -1 -1
2 0
1 1 2
2 0
1 3 4
2 2
3 2
0 1 2
1 -1 -1
2 -1 -1
1 1 2
2 0

样例输出

1
3
4
2


指针、new 和结构体



```cpp
struct Node{
    char val;
    Node* left;
    Node* right;
};
Node* p=new Node{'A',nullptr,nullptr};
p->left=new Node{'B',nullptr,nullptr};
```

appendix
1. [P1305 新二叉树](https://www.luogu.com.cn/problem/P1305)
2. [B3642 二叉树的遍历](https://www.luogu.com.cn/problem/B3642)
3. [P4913 二叉树深度](https://www.luogu.com.cn/problem/P4913)
4. [P1827 美国血统](https://www.luogu.com.cn/problem/P1827)
5. [P1030 求先序排列](https://www.luogu.com.cn/problem/P1030)
6. [P1087 FBI 树](https://www.luogu.com.cn/problem/P1087)
7. [P5076 普通二叉树（简化版）](https://www.luogu.com.cn/problem/P5076)
8. [P2171 Hz 吐泡泡](https://www.luogu.com.cn/problem/P2171)
9. [P1229 遍历问题](https://www.luogu.com.cn/problem/P1229)