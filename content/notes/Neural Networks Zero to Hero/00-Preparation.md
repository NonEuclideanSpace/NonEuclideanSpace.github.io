https://emiliofarias.github.io/nn-zero-to-hero-textbook/
### venv 

```bash
mkdir zero-to-hero && cd zero-to-hero
python3 -m venv .venv
source .venv/bin/activate
pip install torch numpy matplotlib jupyter
```

```bash
jupyter notebook
```

![[Pasted image 20261022081408.png]]

Click ==🔴New -> Python3== to create a notebook.
### Datasets 
```bash
curl -fLO https://raw.githubusercontent.com/karpathy/makemore/master/names.txt
curl -fLO https://raw.githubusercontent.com/karpathy/char-rnn/master/data/tinyshakespeare/input.txt
```
![[Screenshot 2026-10-22 at 08.29.18.png]]

