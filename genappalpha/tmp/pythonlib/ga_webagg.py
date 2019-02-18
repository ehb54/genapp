import numpy as np
import matplotlib 

print matplotlib.rcParams
matplotlib.use('webagg')
import matplotlib.pyplot as plt
import matplotlib.animation as animation
def update_line(num, data, line):
    print "update_line"
    line.set_data(data[..., :num])
    return line,

from genapp import genapp

ga = genapp( {
    '_uuid'     : 'my_uuid'
    ,'_udphost' : '127.0.0.1'
    ,'_udpport'  : 2234
    ,'_mplhost'  : '127.0.0.1'
    } )

print "create figure"
fig1 = plt.figure()

data = np.random.rand(2, 25)
l, = plt.plot([], [], 'r-')
plt.xlim(0, 1)
plt.ylim(0, 1)
plt.xlabel('x')
plt.title('test')
line_ani = animation.FuncAnimation(fig1, update_line, 25, fargs=(data, l),
                                   interval=200, blit=True)


ga.test()
ga.plotshow( matplotlib, plt, 8081 )

