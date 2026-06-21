/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string;
  email: string;
  bio?: string;
  profilePic?: string; // base64 string or blob URL
  createdAt: number;
  emailVerified?: boolean;
  isBlocked?: boolean;
  followers?: string[]; // user IDs following this user
  following?: string[]; // user IDs followed by this user
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  userProfilePic?: string;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  userId: string;
  username: string;
  userProfilePic?: string;
  type: 'video' | 'image';
  mediaData: string; // base64 representation of data OR object URL (as retrieved/joined)
  caption: string;
  createdAt: number;
  likes: string[]; // array of userIds
  comments: Comment[];
  reports?: { id: string; userId: string; reason: string; createdAt: number }[];
  isFlaggedSpam?: boolean;
  tags?: string[]; // automated tags or clean strings starting with #
}

export interface AppNotification {
  id: string;
  userId: string; // recipient of the notification
  type: 'follow' | 'like' | 'comment' | 'reply';
  senderId: string;
  senderName: string;
  senderProfilePic?: string;
  postId?: string; // if liked/commented/replied
  commentId?: string; // if comment/reply
  createdAt: number;
  isRead: boolean;
}

const DB_NAME = 'MyVideoXXX_DB';
const DB_VERSION = 3;

let dbInstance: IDBDatabase | null = null;

export function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Falha ao abrir o banco de dados local.'));
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store de Usuários
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('email', 'email', { unique: true });
        userStore.createIndex('username', 'username', { unique: true });
      }

      // Store de Publicações
      if (!db.objectStoreNames.contains('posts')) {
        const postStore = db.createObjectStore('posts', { keyPath: 'id' });
        postStore.createIndex('createdAt', 'createdAt', { unique: false });
        postStore.createIndex('userId', 'userId', { unique: false });
      }

      // Store de Notificações
      if (!db.objectStoreNames.contains('notifications')) {
        const notiStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notiStore.createIndex('userId', 'userId', { unique: false });
        notiStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

// Operações de Usuário
export async function saveUserToDB(user: User & { passwordHash: string }): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const request = store.put(user);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao salvar usuário.'));
  });
}

export async function getUserById(id: string): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.get(id);
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(new Error('Erro ao obter usuário por ID.'));
  });
}

export async function findUserByEmail(email: string): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const index = store.index('email');
    const request = index.get(email);
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(new Error('Erro ao buscar e-mail.'));
  });
}

export async function findUserByUsername(username: string): Promise<(User & { passwordHash: string }) | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const index = store.index('username');
    const request = index.get(username.toLowerCase());
    request.onsuccess = () => {
      resolve(request.result || null);
    };
    request.onerror = () => reject(new Error('Erro ao buscar nome de usuário.'));
  });
}

// Operações de Posts
export async function createPostInDB(post: Post): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const request = store.add(post);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao criar publicação.'));
  });
}

export async function getAllPostsFromDB(): Promise<Post[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly');
    const store = tx.objectStore('posts');
    const index = store.index('createdAt');
    const posts: Post[] = [];
    
    // Obter todos do mais recente para o mais antigo usando um cursor reverso
    const request = index.openCursor(null, 'prev');
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        posts.push(cursor.value);
        cursor.continue();
      } else {
        resolve(posts);
      }
    };
    request.onerror = () => reject(new Error('Erro ao carregar publicações.'));
  });
}

export async function updatePostInDB(post: Post): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const request = store.put(post);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao atualizar publicação.'));
  });
}

export async function deletePostFromDB(postId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const request = store.delete(postId);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao excluir publicação.'));
  });
}

export async function getPostCountForUser(userId: string): Promise<number> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readonly');
    const store = tx.objectStore('posts');
    const index = store.index('userId');
    const request = index.count(userId);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => reject(new Error('Erro ao contar publicações.'));
  });
}

export async function updateAllPostsUserMetadataInDB(userId: string, username: string, profilePic?: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['posts'], 'readwrite');
    const store = tx.objectStore('posts');
    const index = store.index('userId');
    const request = index.openCursor(userId);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const post = cursor.value as Post;
        post.username = username;
        post.userProfilePic = profilePic;
        
        // Também atualizar comentários do mesmo usuário em qualquer post
        cursor.update(post);
        cursor.continue();
      } else {
        // Agora vamos passear por todos os posts para atualizar os comentários desse usuário
        const allTx = db.transaction(['posts'], 'readwrite');
        const allStore = allTx.objectStore('posts');
        const allReq = allStore.openCursor();
        allReq.onsuccess = (ev) => {
          const allCursor = (ev.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (allCursor) {
            const p = allCursor.value as Post;
            let updated = false;
            p.comments = p.comments.map(c => {
              if (c.userId === userId) {
                updated = true;
                return { ...c, username, userProfilePic: profilePic };
              }
              return c;
            });
            if (updated) {
              allCursor.update(p);
            }
            allCursor.continue();
          } else {
            resolve();
          }
        };
      }
    };
    request.onerror = () => reject(new Error('Erro ao atualizar dados nas publicações.'));
  });
}

export async function reportPostInDB(postId: string, userId: string, reason: string): Promise<Post> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('posts', 'readwrite');
    const store = tx.objectStore('posts');
    const getRequest = store.get(postId);

    getRequest.onsuccess = () => {
      const post = getRequest.result as Post;
      if (!post) {
        reject(new Error('Publicação não encontrada.'));
        return;
      }
      
      if (!post.reports) {
        post.reports = [];
      }
      
      // Check if user already reported
      const alreadyReported = post.reports.some(r => r.userId === userId);
      if (!alreadyReported) {
        post.reports.push({
          id: 'report_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          userId,
          reason,
          createdAt: Date.now()
        });
      }

      // Spam limit threshold auto-flagging
      if (post.reports.length >= 3) {
        post.isFlaggedSpam = true;
      }

      const putRequest = store.put(post);
      putRequest.onsuccess = () => resolve(post);
      putRequest.onerror = () => reject(new Error('Erro ao registrar denúncia.'));
    };
    
    getRequest.onerror = () => reject(new Error('Erro ao obter publicação para denúncia.'));
  });
}

export async function toggleUserBlockInDB(userId: string, shouldBlock: boolean): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const getRequest = store.get(userId);

    getRequest.onsuccess = () => {
      const user = getRequest.result;
      if (!user) {
        reject(new Error('Usuário não localizado.'));
        return;
      }

      user.isBlocked = shouldBlock;
      const putRequest = store.put(user);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(new Error('Erro ao salvar estado de suspensão.'));
    };

    getRequest.onerror = () => reject(new Error('Erro ao carregar usuário para suspensão.'));
  });
}

// REDE SOCIAL: Seguir e Deixar de Seguir Usuários
export async function followUserInDB(currentUserId: string, targetUserId: string): Promise<void> {
  if (currentUserId === targetUserId) return;
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    
    // Obter o usuário logado
    const getCurReq = store.get(currentUserId);
    getCurReq.onsuccess = () => {
      const currentUser = getCurReq.result;
      if (!currentUser) {
        reject(new Error('Usuário logado não encontrado.'));
        return;
      }
      
      // Obter o usuário que vai ser seguido
      const getTargetReq = store.get(targetUserId);
      getTargetReq.onsuccess = () => {
        const targetUser = getTargetReq.result;
        if (!targetUser) {
          reject(new Error('Usuário alvo não encontrado.'));
          return;
        }
        
        // Inicializar arrays se necessário
        if (!currentUser.following) currentUser.following = [];
        if (!targetUser.followers) targetUser.followers = [];
        
        // Adicionar relação se não existir
        if (!currentUser.following.includes(targetUserId)) {
          currentUser.following.push(targetUserId);
        }
        if (!targetUser.followers.includes(currentUserId)) {
          targetUser.followers.push(currentUserId);
        }
        
        // Salvar ambos de volta
        store.put(currentUser);
        store.put(targetUser);
        
        // Criar notificação para o usuário alvo
        createNotificationInDB({
          userId: targetUserId,
          type: 'follow',
          senderId: currentUserId,
          senderName: currentUser.username,
          senderProfilePic: currentUser.profilePic
        }).then(() => resolve()).catch(() => resolve());
      };
      
      getTargetReq.onerror = () => reject(new Error('Erro ao obter usuário de destino.'));
    };
    
    getCurReq.onerror = () => reject(new Error('Erro ao obter usuário de origem.'));
  });
}

export async function unfollowUserInDB(currentUserId: string, targetUserId: string): Promise<void> {
  const db = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    
    const getCurReq = store.get(currentUserId);
    getCurReq.onsuccess = () => {
      const currentUser = getCurReq.result;
      if (!currentUser) {
        reject(new Error('Usuário atual não localizado.'));
        return;
      }
      
      const getTargetReq = store.get(targetUserId);
      getTargetReq.onsuccess = () => {
        const targetUser = getTargetReq.result;
        if (!targetUser) {
          reject(new Error('Usuário alvo não localizado.'));
          return;
        }
        
        if (currentUser.following) {
          currentUser.following = currentUser.following.filter((id: string) => id !== targetUserId);
        }
        if (targetUser.followers) {
          targetUser.followers = targetUser.followers.filter((id: string) => id !== currentUserId);
        }
        
        store.put(currentUser);
        store.put(targetUser);
        resolve();
      };
      
      getTargetReq.onerror = () => reject(new Error('Erro ao buscar o perfil alvo.'));
    };
    
    getCurReq.onerror = () => reject(new Error('Erro ao buscar seu perfil.'));
  });
}

export async function getAllUsersFromDB(): Promise<User[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const request = store.getAll();
    request.onsuccess = () => {
      const all: any[] = request.result || [];
      // Omitir o hash de senha para segurança do payload local
      const filtered: User[] = all.map(({ passwordHash, ...rest }) => rest);
      resolve(filtered);
    };
    request.onerror = () => reject(new Error('Erro ao carregar lista de usuários.'));
  });
}

export async function getFollowersList(userId: string): Promise<User[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const getReq = store.get(userId);
    
    getReq.onsuccess = () => {
      const user = getReq.result;
      if (!user || !user.followers || user.followers.length === 0) {
        resolve([]);
        return;
      }
      
      const promises = user.followers.map((followerId: string) => {
        return new Promise<User | null>((res) => {
          const req = store.get(followerId);
          req.onsuccess = () => {
            if (req.result) {
              const { passwordHash, ...safeUser } = req.result;
              res(safeUser);
            } else {
              res(null);
            }
          };
          req.onerror = () => res(null);
        });
      });
      
      Promise.all(promises).then((results) => {
        resolve(results.filter((u): u is User => u !== null));
      });
    };
    getReq.onerror = () => reject(new Error('Erro ao carregar seguidores.'));
  });
}

export async function getFollowingList(userId: string): Promise<User[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');
    const getReq = store.get(userId);
    
    getReq.onsuccess = () => {
      const user = getReq.result;
      if (!user || !user.following || user.following.length === 0) {
        resolve([]);
        return;
      }
      
      const promises = user.following.map((followingId: string) => {
        return new Promise<User | null>((res) => {
          const req = store.get(followingId);
          req.onsuccess = () => {
            if (req.result) {
              const { passwordHash, ...safeUser } = req.result;
              res(safeUser);
            } else {
              res(null);
            }
          };
          req.onerror = () => res(null);
        });
      });
      
      Promise.all(promises).then((results) => {
        resolve(results.filter((u): u is User => u !== null));
      });
    };
    getReq.onerror = () => reject(new Error('Erro ao carregar usuários seguidos.'));
  });
}

export async function getSuggestedUsers(currentUserId: string | null): Promise<User[]> {
  try {
    const all = await getAllUsersFromDB();
    let currentFollowing: string[] = [];
    
    if (currentUserId) {
      const db = await getDB();
      const user: any = await new Promise((res) => {
        const tx = db.transaction('users', 'readonly');
        const req = tx.objectStore('users').get(currentUserId);
        req.onsuccess = () => res(req.result || null);
        req.onerror = () => res(null);
      });
      if (user && user.following) {
        currentFollowing = user.following;
      }
    }
    
    return all.filter(u => {
      if (currentUserId && u.id === currentUserId) return false;
      if (currentFollowing.includes(u.id)) return false;
      return !u.isBlocked;
    }).slice(0, 5);
  } catch (err) {
    console.error('Erro em sugestões de usuários: ', err);
    return [];
  }
}

// CENTRAL DE NOTIFICAÇÕES
export async function createNotificationInDB(notif: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    
    const newNotification: AppNotification = {
      ...notif,
      id: 'noti_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      createdAt: Date.now(),
      isRead: false
    };
    
    const request = store.add(newNotification);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(new Error('Erro ao registrar notificação.'));
  });
}

export async function getNotificationsForUser(userId: string): Promise<AppNotification[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readonly');
    const store = tx.objectStore('notifications');
    const index = store.index('userId');
    const notifications: AppNotification[] = [];
    
    const request = index.openCursor(userId);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        notifications.push(cursor.value);
        cursor.continue();
      } else {
        // Ordenar mais novas primeiro
        resolve(notifications.sort((a,b) => b.createdAt - a.createdAt));
      }
    };
    request.onerror = () => reject(new Error('Erro ao obter notificações.'));
  });
}

export async function markNotificationsAsRead(userId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('notifications', 'readwrite');
    const store = tx.objectStore('notifications');
    const index = store.index('userId');
    
    const request = index.openCursor(userId);
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        const noti = cursor.value as AppNotification;
        if (!noti.isRead) {
          noti.isRead = true;
          cursor.update(noti);
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(new Error('Erro ao marcar notificações como lidas.'));
  });
}

