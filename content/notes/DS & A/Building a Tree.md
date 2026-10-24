建立树
```cpp
struct Node{
	char val;
	Node* left;
	Node* right;
}
Node* =new Node{'A',nullptr,nullptr};
p->left=new Node{'B',nullptr,nullptr};
```
ABD..EF..G..C..
![[Screenshot 2026-10-24 at 02.47.00.png]]
ABD..EF..G..C..
读入ABD..之后，E怎么判断挂在哪里？
v1 ac
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
        cnt++;            build(node->left);
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